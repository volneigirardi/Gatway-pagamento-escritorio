import { hydrateFileEnvironment } from "@saas/config";
import { Argon2idPasswordHasher, validatePasswordPolicy } from "@saas/auth";
import { closeKysely, createKysely } from "@saas/database";
import { sql } from "kysely";
import type { AdminDatabase } from "../src/common/admin-database.js";

const permissions = [
  "platform:dashboard:read",
  "platform:plans:read",
  "platform:plans:write",
  "platform:tenants:read",
  "platform:tenants:write",
  "platform:billing:read",
  "platform:billing:write",
  "platform:audit:read",
  "platform:settings:write",
];

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

async function main(): Promise<void> {
  hydrateFileEnvironment();
  const email = requireEnvironment("PLATFORM_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnvironment("PLATFORM_ADMIN_PASSWORD");
  if (!/^\S+@\S+\.\S+$/u.test(email) || email.length > 320) {
    throw new Error("PLATFORM_ADMIN_EMAIL is invalid");
  }
  validatePasswordPolicy(password);

  const database = createKysely<AdminDatabase>({
    connectionString: requireEnvironment("DATABASE_URL"),
  });
  const hasher = new Argon2idPasswordHasher(
    Number(process.env["ARGON2_MEMORY_KIB"] ?? 19456),
    Number(process.env["ARGON2_ITERATIONS"] ?? 2),
    Number(process.env["ARGON2_PARALLELISM"] ?? 1),
  );
  const passwordHash = await hasher.hash(password);

  try {
    const created = await database
      .transaction()
      .execute(async (transaction) => {
        await sql`SELECT pg_advisory_xact_lock(hashtext('blupo:bootstrap:platform-owner'))`.execute(
          transaction,
        );
        const existingOwners = await transaction
          .selectFrom("identities")
          .innerJoin(
            "platform_identity_roles",
            "platform_identity_roles.identity_id",
            "identities.id",
          )
          .innerJoin(
            "platform_roles",
            "platform_roles.id",
            "platform_identity_roles.role_id",
          )
          .select(["identities.id", "identities.normalized_email"])
          .where("platform_roles.slug", "=", "platform_owner")
          .where("platform_identity_roles.deleted_at", "is", null)
          .where("identities.deleted_at", "is", null)
          .execute();
        if (existingOwners.length > 0) {
          if (existingOwners[0]?.normalized_email === email) return false;
          throw new Error("A different platform owner already exists");
        }

        const conflictingIdentity = await transaction
          .selectFrom("identities")
          .select(["id", "realm"])
          .where("normalized_email", "=", email)
          .executeTakeFirst();
        if (conflictingIdentity) {
          throw new Error("The platform owner email is already in use");
        }

        const role = await transaction
          .insertInto("platform_roles")
          .values({
            name: "Platform Owner",
            slug: "platform_owner",
            description: "Reserved Blupo platform owner role",
            reserved: true,
          })
          .onConflict((conflict) =>
            conflict.column("slug").doUpdateSet({
              name: "Platform Owner",
              description: "Reserved Blupo platform owner role",
              reserved: true,
              deleted_at: null,
            }),
          )
          .returning("id")
          .executeTakeFirstOrThrow();

        const identity = await transaction
          .insertInto("identities")
          .values({
            email,
            display_name:
              process.env["PLATFORM_ADMIN_NAME"] ?? "Platform Owner",
            normalized_email: email,
            password_hash: passwordHash,
            realm: "platform",
            tenant_id: null,
            status: "pending",
            must_change_password: true,
            mfa_required: true,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto("platform_identity_roles")
          .values({ identity_id: identity.id, role_id: role.id })
          .execute();

        for (const permissionKey of permissions) {
          const permission = await transaction
            .insertInto("platform_permissions")
            .values({ key: permissionKey })
            .onConflict((conflict) =>
              conflict.column("key").doUpdateSet({ deleted_at: null }),
            )
            .returning("id")
            .executeTakeFirstOrThrow();
          const existingGrant = await transaction
            .selectFrom("platform_role_permissions")
            .select("id")
            .where("role_id", "=", role.id)
            .where("permission_id", "=", permission.id)
            .where("deleted_at", "is", null)
            .executeTakeFirst();
          if (!existingGrant) {
            await transaction
              .insertInto("platform_role_permissions")
              .values({ role_id: role.id, permission_id: permission.id })
              .execute();
          }
        }

        await transaction
          .insertInto("platform_audit_logs")
          .values({
            actor_identity_id: identity.id,
            action: "platform.owner.bootstrapped",
            resource: "identity",
            resource_id: identity.id,
            metadata: {},
          })
          .execute();
        return true;
      });

    process.stdout.write(
      `${
        created
          ? "Platform owner bootstrapped successfully"
          : "Platform owner already exists; no changes applied"
      }\n`,
    );
  } finally {
    await closeKysely(database);
  }
}

void main();
