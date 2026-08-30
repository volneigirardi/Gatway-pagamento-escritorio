import { Injectable } from "@nestjs/common";
import { sql, type Selectable, type Transaction } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { AdminDatabaseService } from "../../common/database.module.js";
import { toSafeInteger } from "../../common/safe-integer.js";

export type InvoiceRow = Selectable<AdminDatabase["invoices"]>;
export type PaymentRow = Selectable<AdminDatabase["payments"]>;
export type SubscriptionRow = Selectable<AdminDatabase["subscriptions"]>;
export type InvoiceListRow = InvoiceRow & { tenant_name: string };
export type PaymentListRow = PaymentRow & { tenant_name: string };
export type SubscriptionListRow = SubscriptionRow & { tenant_name: string };

@Injectable()
export class BillingRepository {
  constructor(private readonly database: AdminDatabaseService) {}

  async findSubscription(
    transaction: Transaction<AdminDatabase>,
    subscriptionId: string,
    tenantId: string,
  ): Promise<SubscriptionRow | undefined> {
    return transaction
      .selectFrom("subscriptions")
      .selectAll()
      .where("id", "=", subscriptionId)
      .where("tenant_id", "=", tenantId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
  }

  async createInvoice(
    transaction: Transaction<AdminDatabase>,
    input: {
      id: string;
      tenantId: string;
      subscriptionId: string;
      number: string;
      currency: string;
      subtotalCents: number;
      discountCents: number;
      taxCents: number;
      totalCents: number;
      dueDate: string;
      items: {
        description: string;
        quantity: number;
        unitAmountCents: number;
        totalCents: number;
      }[];
    },
  ): Promise<InvoiceRow> {
    const invoice = await transaction
      .insertInto("invoices")
      .values({
        id: input.id,
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        number: input.number,
        status: "open",
        currency: input.currency,
        subtotal_cents: String(input.subtotalCents),
        discount_cents: String(input.discountCents),
        tax_cents: String(input.taxCents),
        total_cents: String(input.totalCents),
        due_date: input.dueDate,
        issued_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto("invoice_items")
      .values(
        input.items.map((item) => ({
          tenant_id: input.tenantId,
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_amount_cents: String(item.unitAmountCents),
          total_cents: String(item.totalCents),
        })),
      )
      .execute();
    return invoice;
  }

  async findInvoiceForUpdate(
    transaction: Transaction<AdminDatabase>,
    invoiceId: string,
    tenantId: string,
  ): Promise<InvoiceRow | undefined> {
    return transaction
      .selectFrom("invoices")
      .selectAll()
      .where("id", "=", invoiceId)
      .where("tenant_id", "=", tenantId)
      .where("deleted_at", "is", null)
      .forUpdate()
      .executeTakeFirst();
  }

  async paidAmountCents(
    transaction: Transaction<AdminDatabase>,
    invoiceId: string,
    tenantId: string,
  ): Promise<number> {
    const result = await transaction
      .selectFrom("payments")
      .select(sql<string>`coalesce(sum(amount_cents), 0)`.as("total"))
      .where("tenant_id", "=", tenantId)
      .where("invoice_id", "=", invoiceId)
      .where("status", "=", "paid")
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow();
    return toSafeInteger(result.total, "paid amount");
  }

  async createPayment(
    transaction: Transaction<AdminDatabase>,
    input: {
      tenantId: string;
      invoiceId: string;
      method: AdminDatabase["payments"]["method"];
      status: "pending" | "paid" | "failed";
      amountCents: number;
      externalReference?: string;
      failureCode?: string;
      occurredAt: Date;
    },
  ): Promise<PaymentRow> {
    return transaction
      .insertInto("payments")
      .values({
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId,
        method: input.method,
        status: input.status,
        currency: "BRL",
        amount_cents: String(input.amountCents),
        external_reference: input.externalReference ?? null,
        failure_code: input.failureCode ?? null,
        paid_at: input.status === "paid" ? input.occurredAt : null,
        failed_at: input.status === "failed" ? input.occurredAt : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markInvoicePaid(
    transaction: Transaction<AdminDatabase>,
    invoiceId: string,
    tenantId: string,
    paidAt: Date,
  ): Promise<void> {
    await transaction
      .updateTable("invoices")
      .set({ status: "paid", paid_at: paidAt })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", invoiceId)
      .where("deleted_at", "is", null)
      .execute();
  }

  async listInvoices(input: {
    limit: number;
    tenantId?: string;
    status?: InvoiceRow["status"];
    from?: string;
    to?: string;
    before?: { createdAt: Date; id: string };
  }): Promise<InvoiceListRow[]> {
    let query = this.database.db
      .selectFrom("invoices")
      .innerJoin("tenants", "tenants.id", "invoices.tenant_id")
      .selectAll("invoices")
      .select("tenants.name as tenant_name")
      .where("invoices.deleted_at", "is", null);
    if (input.tenantId) {
      query = query.where("invoices.tenant_id", "=", input.tenantId);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (input.status === "overdue") {
      query = query.where((expression) =>
        expression.or([
          expression("invoices.status", "=", "overdue"),
          expression.and([
            expression("invoices.status", "=", "open"),
            expression("invoices.due_date", "<", today),
          ]),
        ]),
      );
    } else if (input.status === "open") {
      query = query
        .where("invoices.status", "=", "open")
        .where("invoices.due_date", ">=", today);
    } else if (input.status) {
      query = query.where("invoices.status", "=", input.status);
    }
    if (input.from) {
      query = query.where("invoices.due_date", ">=", input.from);
    }
    if (input.to) query = query.where("invoices.due_date", "<=", input.to);
    const before = input.before;
    if (before) {
      query = query.where((expression) =>
        expression.or([
          expression("invoices.created_at", "<", before.createdAt),
          expression.and([
            expression("invoices.created_at", "=", before.createdAt),
            expression("invoices.id", "<", before.id),
          ]),
        ]),
      );
    }
    return query
      .orderBy("invoices.created_at", "desc")
      .orderBy("invoices.id", "desc")
      .limit(input.limit + 1)
      .execute();
  }

  async listPayments(input: {
    limit: number;
    tenantId?: string;
    status?: PaymentRow["status"];
    before?: { createdAt: Date; id: string };
  }): Promise<PaymentListRow[]> {
    let query = this.database.db
      .selectFrom("payments")
      .innerJoin("tenants", "tenants.id", "payments.tenant_id")
      .selectAll("payments")
      .select("tenants.name as tenant_name")
      .where("payments.deleted_at", "is", null);
    if (input.tenantId) {
      query = query.where("payments.tenant_id", "=", input.tenantId);
    }
    if (input.status) query = query.where("payments.status", "=", input.status);
    const before = input.before;
    if (before) {
      query = query.where((expression) =>
        expression.or([
          expression("payments.created_at", "<", before.createdAt),
          expression.and([
            expression("payments.created_at", "=", before.createdAt),
            expression("payments.id", "<", before.id),
          ]),
        ]),
      );
    }
    return query
      .orderBy("payments.created_at", "desc")
      .orderBy("payments.id", "desc")
      .limit(input.limit + 1)
      .execute();
  }

  async listSubscriptions(input: {
    limit: number;
    tenantId?: string;
    status?: SubscriptionRow["status"];
    before?: { createdAt: Date; id: string };
  }): Promise<SubscriptionListRow[]> {
    let query = this.database.db
      .selectFrom("subscriptions")
      .innerJoin("tenants", "tenants.id", "subscriptions.tenant_id")
      .selectAll("subscriptions")
      .select("tenants.name as tenant_name")
      .where("subscriptions.deleted_at", "is", null);
    if (input.tenantId) {
      query = query.where("subscriptions.tenant_id", "=", input.tenantId);
    }
    if (input.status) {
      query = query.where("subscriptions.status", "=", input.status);
    }
    const before = input.before;
    if (before) {
      query = query.where((expression) =>
        expression.or([
          expression("subscriptions.created_at", "<", before.createdAt),
          expression.and([
            expression("subscriptions.created_at", "=", before.createdAt),
            expression("subscriptions.id", "<", before.id),
          ]),
        ]),
      );
    }
    return query
      .orderBy("subscriptions.created_at", "desc")
      .orderBy("subscriptions.id", "desc")
      .limit(input.limit + 1)
      .execute();
  }
}
