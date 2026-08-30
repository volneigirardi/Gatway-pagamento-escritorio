import { expect, test, type Page } from "@playwright/test";

const platformUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@blupo.test",
  realm: "platform",
  roles: ["platform_owner"],
  permissions: [
    "platform:dashboard:read",
    "platform:plans:read",
    "platform:tenants:read",
    "platform:billing:read",
    "platform:audit:read",
    "platform:settings:read",
  ],
  mustChangePassword: false,
  mfaEnabled: true,
};

const tenantUser = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@tenant.test",
  realm: "tenant",
  tenantId: "44444444-4444-4444-8444-444444444444",
  roles: ["tenant_super_admin"],
  permissions: [
    "company:read",
    "company:update",
    "subscription:read",
    "security:read",
  ],
  mustChangePassword: false,
  mfaEnabled: true,
};

async function mockPlatform(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "authenticated",
          accessToken: "test-access-token",
          expiresInSeconds: 900,
          csrfToken: "c".repeat(32),
          user: platformUser,
        },
      }),
    }),
  );
  await page.route("**/api/v1/platform/dashboard?period=30d", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          generatedAt: "2026-08-24T12:00:00.000Z",
          period: {
            key: "30d",
            from: "2026-07-25T12:00:00.000Z",
            to: "2026-08-24T12:00:00.000Z",
          },
          metrics: {
            mrrCents: 19900,
            arrCents: 238800,
            activeTenants: 1,
            trialingTenants: 0,
            suspendedTenants: 0,
            newTenants: 1,
            receivedCents: 19900,
            outstandingCents: 0,
            arpaCents: 19900,
            paymentSuccessRate: 100,
            churnRate: 0,
          },
          series: [
            {
              period: "2026-08",
              receivedCents: 19900,
              newTenants: 1,
              subscriptionValueCents: 19900,
            },
          ],
          planDistribution: [
            {
              planId: "22222222-2222-4222-8222-222222222222",
              planName: "Profissional",
              tenants: 1,
            },
          ],
          paymentDistribution: [],
          attention: { overdueInvoices: [], failedProvisioning: [] },
        },
      }),
    }),
  );
}

async function mockTenant(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "authenticated",
          accessToken: "tenant-test-access-token",
          expiresInSeconds: 900,
          csrfToken: "t".repeat(32),
          user: tenantUser,
        },
      }),
    }),
  );
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "authenticated",
          accessToken: "tenant-refreshed-access-token",
          expiresInSeconds: 900,
          csrfToken: "r".repeat(32),
          user: tenantUser,
        },
      }),
    }),
  );
  await page.route("**/api/v1/tenant/overview", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          settings: {
            id: "55555555-5555-4555-8555-555555555555",
            legalName: "Tenant Test Ltda",
            tradeName: "Tenant Test",
            taxId: "12345678000195",
            contactEmail: "finance@tenant.test",
            timezone: "America/Sao_Paulo",
            locale: "pt-BR",
            updatedAt: "2026-08-24T12:00:00.000Z",
          },
          activeUsers: 1,
          currentUser: {
            displayName: "Tenant Admin",
            email: "admin@tenant.test",
          },
          subscription: {
            planName: "Profissional",
            status: "active",
            billingInterval: "monthly",
            amountCents: 19900,
            currency: "BRL",
            currentPeriodEnd: "2026-09-24T12:00:00.000Z",
            trialEndsAt: null,
          },
        },
      }),
    }),
  );
}

test.describe("authentication and navigation", () => {
  test("redirects anonymous users to the unified login", async ({ page }) => {
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });

  test("authenticates a platform owner and loads real dashboard states", async ({
    page,
  }) => {
    await mockPlatform(page);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("owner@blupo.test");
    await page.getByLabel("Senha").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/platform$/);
    await expect(
      page.getByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    await expect(page.getByText("R$ 199,00").first()).toBeVisible();
    const openMenu = page.getByRole("button", {
      name: "Abrir menu",
      exact: true,
    });
    if (await openMenu.isVisible()) await openMenu.click();
    await expect(page.getByRole("link", { name: "Empresas" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Empresa", exact: true }),
    ).toHaveCount(0);
    const stored = await page.evaluate(() => ({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
    }));
    expect(JSON.stringify(stored)).not.toContain("test-access-token");
    expect(stored.session["blupo.csrf"]).toHaveLength(32);
  });

  test("routes a tenant administrator only to the company portal", async ({
    page,
  }) => {
    await mockTenant(page);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("admin@tenant.test");
    await page.getByLabel("Senha").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Olá, Tenant Admin" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tenant Test", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Planos" })).toHaveCount(0);
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("supports keyboard bypass and mobile navigation", async ({ page }) => {
    await page.goto("/login");
    const skipLink = page.getByRole("link", {
      name: "Pular para o conteúdo principal",
    });
    await expect(skipLink).toHaveAttribute("href", "#main");
    await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");
  });

  test("does not produce browser console errors on login", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("kaspersky-labs.com")
      ) {
        errors.push(message.text());
      }
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
