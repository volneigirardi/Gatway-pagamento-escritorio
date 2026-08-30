import { z } from "zod";

const amountSchema = z.number().int().min(0).max(1_000_000_000_000);
export const subscriptionStatusSchema = z.enum([
  "pending",
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
]);
export const invoiceStatusSchema = z.enum([
  "draft",
  "open",
  "paid",
  "overdue",
  "void",
]);
export const paymentMethodSchema = z.enum([
  "manual",
  "bank_transfer",
  "pix",
  "card",
  "other",
]);
export const paymentStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "refunded",
  "canceled",
]);

export const createInvoiceRequestSchema = z
  .object({
    tenantId: z.uuid(),
    subscriptionId: z.uuid(),
    dueDate: z.iso.date(),
    discountCents: amountSchema.default(0),
    taxCents: amountSchema.default(0),
    items: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(500),
            quantity: z.number().int().min(1).max(100_000),
            unitAmountCents: amountSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const recordPaymentRequestSchema = z
  .object({
    tenantId: z.uuid(),
    invoiceId: z.uuid(),
    method: paymentMethodSchema,
    status: z.enum(["pending", "paid", "failed"]).default("paid"),
    amountCents: z.number().int().min(1).max(1_000_000_000_000),
    externalReference: z.string().trim().min(1).max(255).optional(),
    occurredAt: z.iso.datetime().optional(),
    failureCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== "failed" || value.failureCode !== undefined,
    { message: "failureCode is required for failed payments" },
  );

export const subscriptionSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    tenantName: z.string().optional(),
    planId: z.uuid(),
    planPriceId: z.uuid().nullable(),
    status: subscriptionStatusSchema,
    currency: z.string().length(3),
    billingInterval: z.enum(["monthly", "yearly"]),
    amountCents: amountSchema,
    currentPeriodStart: z.iso.datetime(),
    currentPeriodEnd: z.iso.datetime(),
    trialEndsAt: z.iso.datetime().nullable(),
    canceledAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const invoiceSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    tenantName: z.string().optional(),
    subscriptionId: z.uuid(),
    number: z.string(),
    status: invoiceStatusSchema,
    currency: z.string().length(3),
    subtotalCents: amountSchema,
    discountCents: amountSchema,
    taxCents: amountSchema,
    totalCents: amountSchema,
    dueDate: z.iso.date(),
    issuedAt: z.iso.datetime().nullable(),
    paidAt: z.iso.datetime().nullable(),
    voidedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const paymentSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    tenantName: z.string().optional(),
    invoiceId: z.uuid(),
    provider: z.string(),
    externalReference: z.string().nullable(),
    method: paymentMethodSchema,
    status: paymentStatusSchema,
    currency: z.string().length(3),
    amountCents: amountSchema,
    failureCode: z.string().nullable(),
    paidAt: z.iso.datetime().nullable(),
    failedAt: z.iso.datetime().nullable(),
    refundedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const auditLogSchema = z
  .object({
    id: z.uuid(),
    actorIdentityId: z.uuid().nullable(),
    actorEmail: z.string().nullable(),
    action: z.string(),
    resource: z.string(),
    resourceId: z.string().nullable(),
    tenantId: z.uuid().nullable(),
    requestId: z.uuid().nullable(),
    correlationId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const dashboardSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    period: z
      .object({
        key: z.enum(["30d", "90d", "12m"]),
        from: z.iso.datetime(),
        to: z.iso.datetime(),
      })
      .strict(),
    metrics: z
      .object({
        mrrCents: z.number(),
        arrCents: z.number(),
        activeTenants: z.number(),
        trialingTenants: z.number(),
        suspendedTenants: z.number(),
        newTenants: z.number(),
        receivedCents: z.number(),
        outstandingCents: z.number(),
        arpaCents: z.number(),
        paymentSuccessRate: z.number(),
        churnRate: z.number(),
      })
      .strict(),
    series: z.array(
      z
        .object({
          period: z.string(),
          receivedCents: z.number(),
          newTenants: z.number(),
          subscriptionValueCents: z.number(),
        })
        .strict(),
    ),
    planDistribution: z.array(
      z
        .object({
          planId: z.uuid(),
          planName: z.string(),
          tenants: z.number(),
        })
        .strict(),
    ),
    paymentDistribution: z.array(
      z
        .object({
          status: z.string(),
          total: z.number(),
          amountCents: z.number(),
        })
        .strict(),
    ),
    attention: z
      .object({
        overdueInvoices: z.array(
          z
            .object({
              id: z.uuid(),
              number: z.string(),
              tenantId: z.uuid(),
              totalCents: z.number(),
              dueDate: z.iso.date(),
            })
            .strict(),
        ),
        failedProvisioning: z.array(
          z
            .object({
              id: z.uuid(),
              name: z.string(),
              errorCode: z.string().nullable(),
              updatedAt: z.iso.datetime(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const billingListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    tenantId: z.uuid().optional(),
    status: z.string().max(30).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict();

export const dashboardQuerySchema = z
  .object({
    period: z.enum(["30d", "90d", "12m"]).default("30d"),
  })
  .strict();

export const auditLogQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(512).optional(),
    tenantId: z.uuid().optional(),
    action: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export type Subscription = z.infer<typeof subscriptionSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;
export type RecordPaymentRequest = z.infer<typeof recordPaymentRequestSchema>;
export type BillingListQuery = z.infer<typeof billingListQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
