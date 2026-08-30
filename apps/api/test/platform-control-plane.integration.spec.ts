import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { sql } from "kysely";
import { JoseJwtIssuer } from "@saas/auth";
import { closeKysely, createKysely } from "@saas/database";
import { ReportingService } from "../src/modules/reporting/reporting.service.js";
import { getJwtTestKeys, setup, teardown } from "./setup-integration.js";

const platformUserId = "10000000-0000-4000-8000-000000000001";
const permissions = [
  "platform:dashboard:read",
  "platform:plans:read",
  "platform:plans:write",
  "platform:tenants:read",
  "platform:tenants:write",
  "platform:billing:read",
  "platform:billing:write",
  "platform:audit:read",
];

describe("platform control plane API", () => {
  let app: NestFastifyApplication;
  let accessToken: string;
  let tenantAccessToken: string;

  beforeAll(async () => {
    await setup();
    const database = createKysely<unknown>({
      connectionString: process.env.DATABASE_URL!,
    });
    const migrator = new Migrator({
      db: database,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(
          import.meta.dirname,
          "../../../database/migrations/admin",
        ),
        import: async (filePath): Promise<unknown> =>
          (await import(pathToFileURL(filePath).href)) as unknown,
      }),
    });
    const migration = await migrator.migrateToLatest();
    if (migration.error) {
      throw new Error("Admin migration setup failed", {
        cause: migration.error,
      });
    }

    await database.transaction().execute(async (transaction) => {
      await sql`
        INSERT INTO identities (
          id, email, display_name, normalized_email, password_hash, realm,
          status, must_change_password, mfa_required
        ) VALUES (
          ${platformUserId},
          'owner@blupo.com.br',
          'Platform Owner',
          'owner@blupo.com.br',
          '$argon2id$test',
          'platform',
          'active',
          false,
          true
        )
      `.execute(transaction);
      await sql`
        INSERT INTO platform_roles (id, name, slug, reserved)
        VALUES (
          '11000000-0000-4000-8000-000000000001',
          'Platform Owner',
          'platform_owner',
          true
        )
      `.execute(transaction);
      await sql`
        INSERT INTO platform_identity_roles (identity_id, role_id)
        VALUES (
          ${platformUserId},
          '11000000-0000-4000-8000-000000000001'
        )
      `.execute(transaction);
    });
    await closeKysely(database);

    const keys = getJwtTestKeys();
    const issuer = new JoseJwtIssuer(keys.privateKey, {
      issuer: process.env.JWT_ISSUER!,
      platformAudience: process.env.JWT_PLATFORM_AUDIENCE!,
      tenantAudience: process.env.JWT_TENANT_AUDIENCE!,
      keyId: process.env.JWT_KEY_ID!,
    });
    accessToken = await issuer.issue(
      {
        realm: "platform",
        userId: platformUserId,
        roles: ["platform_owner"],
        permissions,
        tokenId: "12000000-0000-4000-8000-000000000001",
      },
      900,
    );
    tenantAccessToken = await issuer.issue(
      {
        realm: "tenant",
        userId: "20000000-0000-4000-8000-000000000001",
        tenantId: "21000000-0000-4000-8000-000000000001",
        roles: ["tenant_super_admin"],
        permissions: ["company:read"],
        tokenId: "22000000-0000-4000-8000-000000000001",
      },
      900,
    );

    const { AppModule } = await import("../src/app.module.js");
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    app.setGlobalPrefix("/api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET!,
      hook: "onRequest",
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await teardown();
  });

  it("creates plans and tenants idempotently and rejects tenant realm", async () => {
    const server = app.getHttpAdapter().getInstance();
    const authorization = { authorization: `Bearer ${accessToken}` };
    const planKey = "plan-create-000000000001";
    const planPayload = {
      name: "Professional",
      slug: "professional",
      description: "Professional Blupo plan",
      trialDays: 14,
      price: {
        currency: "BRL",
        billingInterval: "monthly",
        amountCents: 19900,
      },
      features: { "users.max": 25, audit: true },
    };
    const createdPlan = await server.inject({
      method: "POST",
      url: "/api/v1/platform/plans",
      headers: { ...authorization, "idempotency-key": planKey },
      payload: planPayload,
    });
    expect(createdPlan.statusCode, createdPlan.body).toBe(201);
    const plan = createdPlan.json<{
      data: { id: string; prices: { id: string }[] };
    }>().data;
    const planPriceId = plan.prices[0]?.id;
    if (!planPriceId) throw new Error("Created plan price is missing");

    const replayedPlan = await server.inject({
      method: "POST",
      url: "/api/v1/platform/plans",
      headers: { ...authorization, "idempotency-key": planKey },
      payload: planPayload,
    });
    expect(replayedPlan.statusCode).toBe(201);
    expect(replayedPlan.headers["idempotency-replayed"]).toBe("true");
    expect(replayedPlan.json()).toEqual(createdPlan.json());

    const conflictingReplay = await server.inject({
      method: "POST",
      url: "/api/v1/platform/plans",
      headers: { ...authorization, "idempotency-key": planKey },
      payload: { ...planPayload, name: "Changed" },
    });
    expect(conflictingReplay.statusCode).toBe(409);

    const concurrentPayload = {
      ...planPayload,
      name: "Enterprise",
      slug: "enterprise",
    };
    const concurrentKey = "plan-concurrent-000000001";
    const [concurrentA, concurrentB] = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/platform/plans",
        headers: { ...authorization, "idempotency-key": concurrentKey },
        payload: concurrentPayload,
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/platform/plans",
        headers: { ...authorization, "idempotency-key": concurrentKey },
        payload: concurrentPayload,
      }),
    ]);
    expect(concurrentA.statusCode).toBe(201);
    expect(concurrentB.statusCode).toBe(201);
    expect(concurrentA.json()).toEqual(concurrentB.json());

    const injectionAttempt = await server.inject({
      method: "POST",
      url: "/api/v1/platform/plans",
      headers: {
        ...authorization,
        "idempotency-key": "plan-create-injection-0001",
      },
      payload: { ...planPayload, slug: "x');drop-table-plans--" },
    });
    expect(injectionAttempt.statusCode).toBe(400);

    const forbiddenTenant = await server.inject({
      method: "POST",
      url: "/api/v1/platform/plans",
      headers: {
        authorization: `Bearer ${tenantAccessToken}`,
        "idempotency-key": "tenant-forbidden-0000001",
      },
      payload: planPayload,
    });
    expect(forbiddenTenant.statusCode).toBe(403);

    const activatedPlan = await server.inject({
      method: "PATCH",
      url: `/api/v1/platform/plans/${plan.id}`,
      headers: {
        ...authorization,
        "idempotency-key": "plan-activate-0000000001",
      },
      payload: { status: "active" },
    });
    expect(activatedPlan.statusCode, activatedPlan.body).toBe(200);

    const tenantKey = "tenant-create-0000000001";
    const createdTenant = await server.inject({
      method: "POST",
      url: "/api/v1/platform/tenants",
      headers: { ...authorization, "idempotency-key": tenantKey },
      payload: {
        name: "Tenant A",
        slug: "tenant-a",
        legalName: "Tenant A Ltda",
        tradeName: "Tenant A",
        taxId: "12345678000195",
        contactEmail: "admin@tenant-a.test",
        planId: plan.id,
        planPriceId,
      },
    });
    expect(createdTenant.statusCode, createdTenant.body).toBe(202);
    expect(createdTenant.json()).toMatchObject({
      data: { status: "provisioning", provisioningStatus: "queued" },
    });
    const tenantId = createdTenant.json<{ data: { id: string } }>().data.id;

    const replayedTenant = await server.inject({
      method: "POST",
      url: "/api/v1/platform/tenants",
      headers: { ...authorization, "idempotency-key": tenantKey },
      payload: {
        name: "Tenant A",
        slug: "tenant-a",
        legalName: "Tenant A Ltda",
        tradeName: "Tenant A",
        taxId: "12345678000195",
        contactEmail: "admin@tenant-a.test",
        planId: plan.id,
        planPriceId,
      },
    });
    expect(replayedTenant.statusCode).toBe(202);
    expect(replayedTenant.headers["idempotency-replayed"]).toBe("true");

    const database = createKysely<unknown>({
      connectionString: process.env.DATABASE_URL!,
    });
    await sql`
      UPDATE tenants
      SET status = 'pending_admin', provisioning_status = 'completed'
      WHERE id = ${tenantId}
    `.execute(database);

    const administrator = await server.inject({
      method: "POST",
      url: `/api/v1/platform/tenants/${tenantId}/administrator`,
      headers: {
        ...authorization,
        "idempotency-key": "tenant-admin-create-00001",
      },
      payload: {
        email: "admin@tenant-a.test",
        temporaryPassword: "Temporary customer password 2026!",
        displayName: "Tenant Administrator",
      },
    });
    expect(administrator.statusCode, administrator.body).toBe(202);
    expect(administrator.json()).toMatchObject({
      data: { tenantId, status: "pending_activation" },
    });

    const replayedAdministrator = await server.inject({
      method: "POST",
      url: `/api/v1/platform/tenants/${tenantId}/administrator`,
      headers: {
        ...authorization,
        "idempotency-key": "tenant-admin-create-00001",
      },
      payload: {
        email: "admin@tenant-a.test",
        temporaryPassword: "A different temporary password 2026!",
        displayName: "Tenant Administrator",
      },
    });
    expect(replayedAdministrator.statusCode).toBe(202);
    expect(replayedAdministrator.headers["idempotency-replayed"]).toBe("true");

    await sql`
      UPDATE tenants SET status = 'active', activated_at = now()
      WHERE id = ${tenantId}
    `.execute(database);
    await sql`
      UPDATE subscriptions SET status = 'active'
      WHERE tenant_id = ${tenantId}
    `.execute(database);

    const forbiddenStatusChange = await server.inject({
      method: "PATCH",
      url: `/api/v1/platform/tenants/${tenantId}/status`,
      headers: {
        authorization: `Bearer ${tenantAccessToken}`,
        "idempotency-key": "tenant-status-forbidden-001",
      },
      payload: { status: "suspended" },
    });
    expect(forbiddenStatusChange.statusCode).toBe(403);

    const suspendedTenant = await server.inject({
      method: "PATCH",
      url: `/api/v1/platform/tenants/${tenantId}/status`,
      headers: {
        ...authorization,
        "idempotency-key": "tenant-status-suspend-0001",
      },
      payload: { status: "suspended" },
    });
    expect(suspendedTenant.statusCode, suspendedTenant.body).toBe(200);
    expect(suspendedTenant.json()).toMatchObject({
      data: { id: tenantId, status: "suspended" },
    });

    const reactivatedTenant = await server.inject({
      method: "PATCH",
      url: `/api/v1/platform/tenants/${tenantId}/status`,
      headers: {
        ...authorization,
        "idempotency-key": "tenant-status-reactivate-01",
      },
      payload: { status: "active" },
    });
    expect(reactivatedTenant.statusCode, reactivatedTenant.body).toBe(200);
    expect(reactivatedTenant.json()).toMatchObject({
      data: { id: tenantId, status: "active" },
    });

    const subscription = await sql<{ id: string }>`
      SELECT id FROM subscriptions WHERE tenant_id = ${tenantId}
    `.execute(database);
    const subscriptionId = subscription.rows[0]?.id;
    if (!subscriptionId) throw new Error("Subscription is missing");
    const futureDueDate = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const paidInvoiceResponse = await server.inject({
      method: "POST",
      url: "/api/v1/platform/billing/invoices",
      headers: {
        ...authorization,
        "idempotency-key": "invoice-create-000000001",
      },
      payload: {
        tenantId,
        subscriptionId,
        dueDate: futureDueDate,
        items: [
          {
            description: "Professional monthly subscription",
            quantity: 1,
            unitAmountCents: 19900,
          },
        ],
      },
    });
    expect(paidInvoiceResponse.statusCode, paidInvoiceResponse.body).toBe(201);
    const paidInvoice = paidInvoiceResponse.json<{
      data: { id: string };
    }>().data;

    const overpayment = await server.inject({
      method: "POST",
      url: "/api/v1/platform/billing/payments",
      headers: {
        ...authorization,
        "idempotency-key": "payment-overpay-00000001",
      },
      payload: {
        tenantId,
        invoiceId: paidInvoice.id,
        method: "manual",
        status: "paid",
        amountCents: 20000,
      },
    });
    expect(overpayment.statusCode).toBe(400);

    const payment = await server.inject({
      method: "POST",
      url: "/api/v1/platform/billing/payments",
      headers: {
        ...authorization,
        "idempotency-key": "payment-create-000000001",
      },
      payload: {
        tenantId,
        invoiceId: paidInvoice.id,
        method: "manual",
        status: "paid",
        amountCents: 19900,
        externalReference: "MANUAL-0001",
      },
    });
    expect(payment.statusCode, payment.body).toBe(201);

    const overdueDueDate = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const overdueInvoice = await server.inject({
      method: "POST",
      url: "/api/v1/platform/billing/invoices",
      headers: {
        ...authorization,
        "idempotency-key": "invoice-create-000000002",
      },
      payload: {
        tenantId,
        subscriptionId,
        dueDate: overdueDueDate,
        items: [
          {
            description: "Additional service",
            quantity: 1,
            unitAmountCents: 5000,
          },
        ],
      },
    });
    expect(overdueInvoice.statusCode, overdueInvoice.body).toBe(201);

    const reporting = app.get(ReportingService);
    await expect(reporting.dashboard("30d")).resolves.toMatchObject({
      metrics: { mrrCents: 19900, receivedCents: 19900 },
    });

    const dashboard = await server.inject({
      method: "GET",
      url: "/api/v1/platform/dashboard?period=30d",
      headers: authorization,
    });
    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json()).toMatchObject({
      data: {
        metrics: {
          mrrCents: 19900,
          arrCents: 238800,
          activeTenants: 1,
          receivedCents: 19900,
          outstandingCents: 5000,
          arpaCents: 19900,
          paymentSuccessRate: 100,
          churnRate: 0,
        },
      },
    });

    const invoices = await server.inject({
      method: "GET",
      url: "/api/v1/platform/billing/invoices?limit=25",
      headers: authorization,
    });
    expect(invoices.statusCode).toBe(200);
    const invoiceItems = invoices.json<{
      data: { status: string; tenantName: string }[];
    }>().data;
    expect(invoiceItems).toHaveLength(2);
    expect(
      invoiceItems.every((invoice) => invoice.tenantName === "Tenant A"),
    ).toBe(true);
    expect(invoiceItems.map((invoice) => invoice.status).sort()).toEqual([
      "overdue",
      "paid",
    ]);

    const auditLogs = await server.inject({
      method: "GET",
      url: "/api/v1/platform/audit-logs?limit=25",
      headers: authorization,
    });
    expect(auditLogs.statusCode, auditLogs.body).toBe(200);
    expect(auditLogs.json<{ data: unknown[] }>().data.length).toBeGreaterThan(
      0,
    );

    const state = await sql<{
      plan_count: number;
      tenant_count: number;
      subscription_count: number;
      outbox_count: number;
      tenant_identity_count: number;
      password_secure: boolean;
      admin_payload_safe: boolean;
    }>`
      SELECT
        (SELECT count(*)::int FROM plans) AS plan_count,
        (SELECT count(*)::int FROM tenants) AS tenant_count,
        (SELECT count(*)::int FROM subscriptions) AS subscription_count,
        (SELECT count(*)::int FROM platform_outbox WHERE event_type = 'tenant.provisioning.requested') AS outbox_count,
        (SELECT count(*)::int FROM identities WHERE realm = 'tenant') AS tenant_identity_count,
        (SELECT bool_and(password_hash LIKE '$argon2id$%' AND must_change_password AND mfa_required) FROM identities WHERE realm = 'tenant') AS password_secure,
        (SELECT bool_and(payload::text NOT ILIKE '%password%' AND payload::text NOT ILIKE '%@%') FROM platform_outbox WHERE event_type = 'tenant.admin.provisioning.requested') AS admin_payload_safe
    `.execute(database);
    await closeKysely(database);
    expect(state.rows[0]).toEqual({
      plan_count: 2,
      tenant_count: 1,
      subscription_count: 1,
      outbox_count: 1,
      tenant_identity_count: 1,
      password_secure: true,
      admin_payload_safe: true,
    });
  });
});
