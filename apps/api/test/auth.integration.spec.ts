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
import { Secret, TOTP } from "otpauth";
import { Argon2idPasswordHasher } from "@saas/auth";
import { closeKysely, createKysely } from "@saas/database";
import { setup, teardown } from "./setup-integration.js";

const initialPassword = "Initial owner password 2026!";
const replacementPassword = "Replacement owner password 2026!";

function cookiePair(setCookie: string | string[] | undefined): string {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
  const refresh = values.find((value) => value.startsWith("blupo_refresh="));
  if (!refresh) throw new Error("Refresh cookie was not returned");
  return refresh.split(";", 1)[0] ?? "";
}

describe("authentication API", () => {
  let app: NestFastifyApplication;

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

    const hasher = new Argon2idPasswordHasher(8192, 1, 1);
    const passwordHash = await hasher.hash(initialPassword);
    await database.transaction().execute(async (transaction) => {
      await sql`
        INSERT INTO platform_roles (id, name, slug, reserved)
        VALUES (
          '10000000-0000-4000-8000-000000000001',
          'Platform Owner',
          'platform_owner',
          true
        )
      `.execute(transaction);
      await sql`
        INSERT INTO platform_permissions (id, key)
        VALUES (
          '11000000-0000-4000-8000-000000000001',
          'platform:dashboard:read'
        )
      `.execute(transaction);
      await sql`
        INSERT INTO identities (
          id, email, normalized_email, password_hash, realm, status,
          must_change_password, mfa_required
        ) VALUES (
          '12000000-0000-4000-8000-000000000001',
          'owner@blupo.com.br',
          'owner@blupo.com.br',
          ${passwordHash},
          'platform',
          'pending',
          true,
          true
        )
      `.execute(transaction);
      await sql`
        INSERT INTO platform_identity_roles (identity_id, role_id)
        VALUES (
          '12000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000001'
        )
      `.execute(transaction);
      await sql`
        INSERT INTO platform_role_permissions (role_id, permission_id)
        VALUES (
          '10000000-0000-4000-8000-000000000001',
          '11000000-0000-4000-8000-000000000001'
        )
      `.execute(transaction);
    });
    await closeKysely(database);

    const { AppModule } = await import("../src/app.module.js");
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: ["error"] },
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
    if (app) await app.close();
    await teardown();
  });

  it("completes password rotation, MFA, refresh rotation, and reuse revocation", async () => {
    const server = app.getHttpAdapter().getInstance();
    const invalid = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "owner@blupo.com.br",
        password: "wrong password",
      },
    });
    expect(invalid.statusCode, invalid.body).toBe(401);
    expect(invalid.json()).not.toHaveProperty("data.challengeToken");

    const login = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "owner@blupo.com.br",
        password: initialPassword,
      },
    });
    expect(login.statusCode).toBe(200);
    const loginData = login.json<{
      data: { status: string; challengeToken: string };
    }>().data;
    expect(loginData.status).toBe("password_change_required");

    const changed = await server.inject({
      method: "POST",
      url: "/api/v1/auth/password/change",
      payload: {
        challengeToken: loginData.challengeToken,
        newPassword: replacementPassword,
      },
    });
    expect(changed.statusCode).toBe(200);
    const changedData = changed.json<{
      data: { status: string; challengeToken: string };
    }>().data;
    expect(changedData.status).toBe("mfa_setup_required");

    const setupMfa = await server.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/setup",
      payload: { challengeToken: changedData.challengeToken },
    });
    expect(setupMfa.statusCode).toBe(200);
    const setupData = setupMfa.json<{
      data: { challengeToken: string; secret: string; uri: string };
    }>().data;
    expect(setupData.uri).toMatch(/^otpauth:\/\//u);

    const code = TOTP.generate({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(setupData.secret),
    });
    const confirmed = await server.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/confirm",
      payload: { challengeToken: setupData.challengeToken, code },
    });
    expect(confirmed.statusCode).toBe(200);
    const confirmedData = confirmed.json<{
      data: {
        status: string;
        accessToken: string;
        csrfToken: string;
        recoveryCodes: string[];
      };
    }>().data;
    expect(confirmedData.status).toBe("authenticated");
    expect(confirmedData.recoveryCodes).toHaveLength(10);
    const firstCookie = cookiePair(confirmed.headers["set-cookie"]);

    const me = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${confirmedData.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      data: {
        realm: "platform",
        roles: ["platform_owner"],
        permissions: ["platform:dashboard:read"],
      },
    });

    const separator = firstCookie.indexOf("=");
    const cookieName = firstCookie.slice(0, separator + 1);
    const cookieValue = firstCookie.slice(separator + 1);
    const tamperedCookie = `${cookieName}${cookieValue.startsWith("A") ? "B" : "A"}${cookieValue.slice(1)}`;
    const invalidCookie = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: tamperedCookie,
        "x-csrf-token": confirmedData.csrfToken,
      },
    });
    expect(invalidCookie.statusCode).toBe(401);

    const invalidCsrf = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: firstCookie,
        "x-csrf-token": "invalid-csrf-token-that-is-long-enough-0000",
      },
    });
    expect(invalidCsrf.statusCode).toBe(401);

    const refreshed = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: firstCookie,
        "x-csrf-token": confirmedData.csrfToken,
      },
    });
    expect(refreshed.statusCode).toBe(200);
    const refreshedData = refreshed.json<{
      data: { accessToken: string; csrfToken: string };
    }>().data;
    const secondCookie = cookiePair(refreshed.headers["set-cookie"]);
    expect(refreshedData.accessToken).not.toBe(confirmedData.accessToken);
    expect(refreshedData.csrfToken).not.toBe(confirmedData.csrfToken);

    const reused = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: firstCookie,
        "x-csrf-token": confirmedData.csrfToken,
      },
    });
    expect(reused.statusCode).toBe(401);

    const revokedFamily = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: secondCookie,
        "x-csrf-token": refreshedData.csrfToken,
      },
    });
    expect(revokedFamily.statusCode).toBe(401);
  });

  it("rate limits repeated invalid login attempts without account disclosure", async () => {
    const server = app.getHttpAdapter().getInstance();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "unknown@blupo.com.br",
          password: "incorrect password value",
        },
      });
      expect(response.statusCode).toBe(401);
    }
    const blocked = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "unknown@blupo.com.br",
        password: "incorrect password value",
      },
    });
    expect(blocked.statusCode).toBe(429);
  });
});
