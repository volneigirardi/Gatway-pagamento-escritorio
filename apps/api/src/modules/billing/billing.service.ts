import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedUser } from "@saas/auth";
import type {
  BillingListQuery,
  CreateInvoiceRequest,
  RecordPaymentRequest,
} from "@saas/contracts";
import { randomUUID } from "node:crypto";
import type { Transaction } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { decodeCursor, encodeCursor } from "../../common/cursor.js";
import { toDateOnly } from "../../common/date-only.js";
import { toSafeInteger } from "../../common/safe-integer.js";
import {
  PlatformIdempotencyService,
  type IdempotentResult,
} from "../../common/platform-idempotency.service.js";
import {
  BillingRepository,
  type InvoiceListRow,
  type InvoiceRow,
  type PaymentListRow,
  type PaymentRow,
  type SubscriptionListRow,
  type SubscriptionRow,
} from "./billing.repository.js";

function invoiceResponse(
  invoice: InvoiceRow | InvoiceListRow,
): Record<string, unknown> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dueDate = toDateOnly(invoice.due_date);
  const status =
    invoice.status === "open" &&
    new Date(`${dueDate}T00:00:00.000Z`).getTime() < today.getTime()
      ? "overdue"
      : invoice.status;
  return {
    id: invoice.id,
    tenantId: invoice.tenant_id,
    ...("tenant_name" in invoice ? { tenantName: invoice.tenant_name } : {}),
    subscriptionId: invoice.subscription_id,
    number: invoice.number,
    status,
    currency: invoice.currency,
    subtotalCents: toSafeInteger(invoice.subtotal_cents, "invoice subtotal"),
    discountCents: toSafeInteger(invoice.discount_cents, "invoice discount"),
    taxCents: toSafeInteger(invoice.tax_cents, "invoice tax"),
    totalCents: toSafeInteger(invoice.total_cents, "invoice total"),
    dueDate,
    issuedAt: invoice.issued_at?.toISOString() ?? null,
    paidAt: invoice.paid_at?.toISOString() ?? null,
    voidedAt: invoice.voided_at?.toISOString() ?? null,
    createdAt: invoice.created_at.toISOString(),
    updatedAt: invoice.updated_at.toISOString(),
  };
}

function paymentResponse(
  payment: PaymentRow | PaymentListRow,
): Record<string, unknown> {
  return {
    id: payment.id,
    tenantId: payment.tenant_id,
    ...("tenant_name" in payment ? { tenantName: payment.tenant_name } : {}),
    invoiceId: payment.invoice_id,
    provider: payment.provider,
    externalReference: payment.external_reference,
    method: payment.method,
    status: payment.status,
    currency: payment.currency,
    amountCents: toSafeInteger(payment.amount_cents, "payment amount"),
    failureCode: payment.failure_code,
    paidAt: payment.paid_at?.toISOString() ?? null,
    failedAt: payment.failed_at?.toISOString() ?? null,
    refundedAt: payment.refunded_at?.toISOString() ?? null,
    createdAt: payment.created_at.toISOString(),
    updatedAt: payment.updated_at.toISOString(),
  };
}

function subscriptionResponse(
  subscription: SubscriptionRow | SubscriptionListRow,
): Record<string, unknown> {
  return {
    id: subscription.id,
    tenantId: subscription.tenant_id,
    ...("tenant_name" in subscription
      ? { tenantName: subscription.tenant_name }
      : {}),
    planId: subscription.plan_id,
    planPriceId: subscription.plan_price_id,
    status: subscription.status,
    currency: subscription.currency,
    billingInterval: subscription.billing_interval,
    amountCents: toSafeInteger(
      subscription.amount_cents,
      "subscription amount",
    ),
    currentPeriodStart: subscription.current_period_start.toISOString(),
    currentPeriodEnd: subscription.current_period_end.toISOString(),
    trialEndsAt: subscription.trial_ends_at?.toISOString() ?? null,
    canceledAt: subscription.canceled_at?.toISOString() ?? null,
    createdAt: subscription.created_at.toISOString(),
    updatedAt: subscription.updated_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

@Injectable()
export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly idempotency: PlatformIdempotencyService,
  ) {}

  async createInvoice(
    user: AuthenticatedUser,
    key: string,
    input: CreateInvoiceRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    const items = input.items.map((item) => ({
      ...item,
      totalCents: item.quantity * item.unitAmountCents,
    }));
    const subtotalCents = items.reduce(
      (total, item) => total + item.totalCents,
      0,
    );
    const totalCents = subtotalCents - input.discountCents + input.taxCents;
    if (
      !Number.isSafeInteger(subtotalCents) ||
      !Number.isSafeInteger(totalCents) ||
      totalCents <= 0 ||
      totalCents > 1_000_000_000_000
    ) {
      throw new BadRequestException("Invoice total is invalid");
    }
    try {
      return await this.idempotency.execute({
        scope: "platform.billing.invoice.create",
        key,
        actorIdentityId: user.userId,
        request: input,
        callback: async (transaction) => {
          const subscription = await this.repository.findSubscription(
            transaction,
            input.subscriptionId,
            input.tenantId,
          );
          if (!subscription || subscription.status === "canceled") {
            throw new BadRequestException("Active subscription is required");
          }
          const invoiceId = randomUUID();
          const invoice = await this.repository.createInvoice(transaction, {
            id: invoiceId,
            tenantId: input.tenantId,
            subscriptionId: input.subscriptionId,
            number: `BLP-${String(new Date().getUTCFullYear())}-${invoiceId.slice(0, 8).toUpperCase()}`,
            currency: subscription.currency,
            subtotalCents,
            discountCents: input.discountCents,
            taxCents: input.taxCents,
            totalCents,
            dueDate: input.dueDate,
            items,
          });
          const value = invoiceResponse(invoice);
          await this.recordMutation(
            transaction,
            user.userId,
            input.tenantId,
            "billing.invoice.created",
            "invoice",
            invoice.id,
            value,
          );
          return value;
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Invoice already exists");
      }
      throw error;
    }
  }

  async recordPayment(
    user: AuthenticatedUser,
    key: string,
    input: RecordPaymentRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    try {
      return await this.idempotency.execute({
        scope: "platform.billing.payment.create",
        key,
        actorIdentityId: user.userId,
        request: input,
        callback: async (transaction) => {
          const invoice = await this.repository.findInvoiceForUpdate(
            transaction,
            input.invoiceId,
            input.tenantId,
          );
          if (!invoice || ["draft", "paid", "void"].includes(invoice.status)) {
            throw new BadRequestException("Open invoice is required");
          }
          const invoiceTotal = toSafeInteger(
            invoice.total_cents,
            "invoice total",
          );
          const paidBefore = await this.repository.paidAmountCents(
            transaction,
            invoice.id,
          );
          if (
            input.status === "paid" &&
            paidBefore + input.amountCents > invoiceTotal
          ) {
            throw new BadRequestException("Payment exceeds invoice balance");
          }
          const occurredAt = input.occurredAt
            ? new Date(input.occurredAt)
            : new Date();
          const payment = await this.repository.createPayment(transaction, {
            tenantId: input.tenantId,
            invoiceId: input.invoiceId,
            method: input.method,
            status: input.status,
            amountCents: input.amountCents,
            ...(input.externalReference
              ? { externalReference: input.externalReference }
              : {}),
            ...(input.failureCode ? { failureCode: input.failureCode } : {}),
            occurredAt,
          });
          if (
            input.status === "paid" &&
            paidBefore + input.amountCents === invoiceTotal
          ) {
            await this.repository.markInvoicePaid(
              transaction,
              invoice.id,
              occurredAt,
            );
          }
          const value = paymentResponse(payment);
          await this.recordMutation(
            transaction,
            user.userId,
            input.tenantId,
            "billing.payment.recorded",
            "payment",
            payment.id,
            value,
          );
          return value;
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Payment reference already exists");
      }
      throw error;
    }
  }

  async listInvoices(input: BillingListQuery): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string | null;
  }> {
    const statuses = ["draft", "open", "paid", "overdue", "void"] as const;
    if (
      input.status &&
      !statuses.includes(input.status as (typeof statuses)[number])
    ) {
      throw new BadRequestException("Invalid invoice status");
    }
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.listInvoices({
      limit: input.limit,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.status
        ? { status: input.status as (typeof statuses)[number] }
        : {}),
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
      ...(before ? { before } : {}),
    });
    return this.page(rows, input.limit, invoiceResponse);
  }

  async listPayments(input: BillingListQuery): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string | null;
  }> {
    const statuses = [
      "pending",
      "paid",
      "failed",
      "refunded",
      "canceled",
    ] as const;
    if (
      input.status &&
      !statuses.includes(input.status as (typeof statuses)[number])
    ) {
      throw new BadRequestException("Invalid payment status");
    }
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.listPayments({
      limit: input.limit,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.status
        ? { status: input.status as (typeof statuses)[number] }
        : {}),
      ...(before ? { before } : {}),
    });
    return this.page(rows, input.limit, paymentResponse);
  }

  async listSubscriptions(input: BillingListQuery): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string | null;
  }> {
    const statuses = [
      "pending",
      "trialing",
      "active",
      "past_due",
      "suspended",
      "canceled",
    ] as const;
    if (
      input.status &&
      !statuses.includes(input.status as (typeof statuses)[number])
    ) {
      throw new BadRequestException("Invalid subscription status");
    }
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.listSubscriptions({
      limit: input.limit,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.status
        ? { status: input.status as (typeof statuses)[number] }
        : {}),
      ...(before ? { before } : {}),
    });
    return this.page(rows, input.limit, subscriptionResponse);
  }

  private page<T extends { id: string; created_at: Date }>(
    rows: T[],
    limit: number,
    mapper: (row: T) => Record<string, unknown>,
  ): { items: Record<string, unknown>[]; nextCursor: string | null } {
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(mapper),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null,
    };
  }

  private async recordMutation(
    transaction: Transaction<AdminDatabase>,
    actorIdentityId: string,
    tenantId: string,
    eventType: string,
    resource: string,
    resourceId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await transaction
      .insertInto("platform_outbox")
      .values({
        aggregate_type: resource === "invoice" ? "Invoice" : "Payment",
        aggregate_id: resourceId,
        event_type: eventType,
        payload,
      })
      .execute();
    await transaction
      .insertInto("platform_audit_logs")
      .values({
        actor_identity_id: actorIdentityId,
        action: eventType,
        resource,
        resource_id: resourceId,
        tenant_id: tenantId,
        metadata: payload,
      })
      .execute();
  }
}
