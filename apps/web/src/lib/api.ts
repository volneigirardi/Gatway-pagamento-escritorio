import {
  auditLogSchema,
  companySettingsSchema,
  createInvoiceRequestSchema,
  createPlanPriceRequestSchema,
  createPlanRequestSchema,
  createTenantAdminRequestSchema,
  createTenantRequestSchema,
  dashboardSchema,
  invoiceSchema,
  paymentSchema,
  planSchema,
  recordPaymentRequestSchema,
  subscriptionSchema,
  tenantOverviewSchema,
  tenantSchema,
  updateCompanySettingsRequestSchema,
  updatePlanRequestSchema,
  updateTenantStatusRequestSchema,
} from "@saas/contracts";
import { z } from "zod";
import { authClient } from "./auth.js";

const cursorMetaSchema = z.object({ nextCursor: z.string().nullable() });

function searchParams(
  values: Record<string, string | number | undefined>,
): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") parameters.set(key, String(value));
  }
  const query = parameters.toString();
  return query ? `?${query}` : "";
}

async function list<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const envelope = await authClient.requestEnvelope(path);
  return {
    items: z.array(schema).parse(envelope.data),
    nextCursor: cursorMetaSchema.parse(envelope.meta).nextCursor,
  };
}

const mutationKeys = new Map<string, { key: string; createdAt: number }>();

async function mutationSignature(
  path: string,
  method: string,
  body: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    `${method}\u0000${path}\u0000${JSON.stringify(body)}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function idempotentMutation(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<unknown> {
  const now = Date.now();
  for (const [signature, entry] of mutationKeys) {
    if (now - entry.createdAt > 15 * 60_000) mutationKeys.delete(signature);
  }
  if (mutationKeys.size >= 100) {
    const oldest = mutationKeys.keys().next().value;
    if (oldest) mutationKeys.delete(oldest);
  }
  const signature = await mutationSignature(path, method, body);
  const entry = mutationKeys.get(signature) ?? {
    key: crypto.randomUUID(),
    createdAt: now,
  };
  mutationKeys.set(signature, entry);
  const result = await authClient.request(path, {
    method,
    headers: { "idempotency-key": entry.key },
    body: JSON.stringify(body),
  });
  mutationKeys.delete(signature);
  return result;
}

export const platformApi = {
  async dashboard(period: "30d" | "90d" | "12m") {
    return dashboardSchema.parse(
      await authClient.request(`/platform/dashboard?period=${period}`),
    );
  },

  auditLogs(
    input: { cursor?: string; action?: string; tenantId?: string } = {},
  ) {
    return list(
      `/platform/audit-logs${searchParams({ limit: 25, cursor: input.cursor, action: input.action, tenantId: input.tenantId })}`,
      auditLogSchema,
    );
  },

  plans(
    input: {
      limit?: number;
      cursor?: string;
      status?: string;
      search?: string;
    } = {},
  ) {
    return list(
      `/platform/plans${searchParams({ limit: input.limit ?? 25, cursor: input.cursor, status: input.status, search: input.search })}`,
      planSchema,
    );
  },

  async createPlan(input: unknown) {
    const body = createPlanRequestSchema.parse(input);
    return planSchema.parse(
      await idempotentMutation("/platform/plans", "POST", body),
    );
  },

  async updatePlan(planId: string, input: unknown) {
    const body = updatePlanRequestSchema.parse(input);
    return planSchema.parse(
      await idempotentMutation(`/platform/plans/${planId}`, "PATCH", body),
    );
  },

  async addPlanPrice(planId: string, input: unknown) {
    const body = createPlanPriceRequestSchema.parse(input);
    return planSchema.parse(
      await idempotentMutation(
        `/platform/plans/${planId}/prices`,
        "POST",
        body,
      ),
    );
  },

  tenants(
    input: {
      limit?: number;
      cursor?: string;
      status?: string;
      search?: string;
    } = {},
  ) {
    return list(
      `/platform/tenants${searchParams({ limit: input.limit ?? 25, cursor: input.cursor, status: input.status, search: input.search })}`,
      tenantSchema,
    );
  },

  async tenant(tenantId: string) {
    return tenantSchema.parse(
      await authClient.request(`/platform/tenants/${tenantId}`),
    );
  },

  async createTenant(input: unknown) {
    const body = createTenantRequestSchema.parse(input);
    return tenantSchema.parse(
      await idempotentMutation("/platform/tenants", "POST", body),
    );
  },

  async updateTenantStatus(tenantId: string, status: string) {
    const body = updateTenantStatusRequestSchema.parse({ status });
    return tenantSchema.parse(
      await idempotentMutation(
        `/platform/tenants/${tenantId}/status`,
        "PATCH",
        body,
      ),
    );
  },

  async createTenantAdmin(tenantId: string, input: unknown) {
    const body = createTenantAdminRequestSchema.parse(input);
    return z
      .object({ tenantId: z.uuid(), identityId: z.uuid(), status: z.string() })
      .parse(
        await idempotentMutation(
          `/platform/tenants/${tenantId}/administrator`,
          "POST",
          body,
        ),
      );
  },

  subscriptions(
    input: { cursor?: string; status?: string; tenantId?: string } = {},
  ) {
    return list(
      `/platform/billing/subscriptions${searchParams({ limit: 25, cursor: input.cursor, status: input.status, tenantId: input.tenantId })}`,
      subscriptionSchema,
    );
  },

  invoices(
    input: { cursor?: string; status?: string; tenantId?: string } = {},
  ) {
    return list(
      `/platform/billing/invoices${searchParams({ limit: 25, cursor: input.cursor, status: input.status, tenantId: input.tenantId })}`,
      invoiceSchema,
    );
  },

  async createInvoice(input: unknown) {
    const body = createInvoiceRequestSchema.parse(input);
    return invoiceSchema.parse(
      await idempotentMutation("/platform/billing/invoices", "POST", body),
    );
  },

  payments(
    input: { cursor?: string; status?: string; tenantId?: string } = {},
  ) {
    return list(
      `/platform/billing/payments${searchParams({ limit: 25, cursor: input.cursor, status: input.status, tenantId: input.tenantId })}`,
      paymentSchema,
    );
  },

  async recordPayment(input: unknown) {
    const body = recordPaymentRequestSchema.parse(input);
    return paymentSchema.parse(
      await idempotentMutation("/platform/billing/payments", "POST", body),
    );
  },
};

export const tenantApi = {
  async overview() {
    return tenantOverviewSchema.parse(
      await authClient.request("/tenant/overview"),
    );
  },

  async settings() {
    return companySettingsSchema.parse(
      await authClient.request("/tenant/settings"),
    );
  },

  async updateSettings(input: unknown) {
    const body = updateCompanySettingsRequestSchema.parse(input);
    return companySettingsSchema.parse(
      await authClient.request("/tenant/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );
  },
};

export type Plan = z.infer<typeof planSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type CompanySettings = z.infer<typeof companySettingsSchema>;
export type TenantOverview = z.infer<typeof tenantOverviewSchema>;
