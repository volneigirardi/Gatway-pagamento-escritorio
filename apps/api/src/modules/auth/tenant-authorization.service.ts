import { Injectable, UnauthorizedException } from "@nestjs/common";
import { withTenantTransaction } from "@saas/database";
import { TenantDatabaseManager } from "../../common/tenant-database.manager.js";

@Injectable()
export class TenantAuthorizationService {
  constructor(private readonly databases: TenantDatabaseManager) {}

  async load(input: {
    tenantId: string;
    databaseName: string;
    identityId: string;
  }): Promise<{ roles: string[]; permissions: string[] }> {
    const database = await this.databases.get(input.databaseName);
    return withTenantTransaction(
      database,
      input.tenantId,
      async (transaction) => {
        const rows = await transaction
          .selectFrom("users")
          .innerJoin("user_roles", (join) =>
            join
              .onRef("user_roles.user_id", "=", "users.id")
              .onRef("user_roles.tenant_id", "=", "users.tenant_id"),
          )
          .innerJoin("roles", (join) =>
            join
              .onRef("roles.id", "=", "user_roles.role_id")
              .onRef("roles.tenant_id", "=", "user_roles.tenant_id"),
          )
          .leftJoin("role_permissions", (join) =>
            join
              .onRef("role_permissions.role_id", "=", "roles.id")
              .onRef("role_permissions.tenant_id", "=", "roles.tenant_id"),
          )
          .leftJoin("permissions", (join) =>
            join
              .onRef("permissions.id", "=", "role_permissions.permission_id")
              .onRef(
                "permissions.tenant_id",
                "=",
                "role_permissions.tenant_id",
              ),
          )
          .select(["roles.slug as role", "permissions.key as permission"])
          .where("users.tenant_id", "=", input.tenantId)
          .where("users.identity_id", "=", input.identityId)
          .where("users.status", "=", "active")
          .where("users.deleted_at", "is", null)
          .where("user_roles.deleted_at", "is", null)
          .where("roles.deleted_at", "is", null)
          .where((expression) =>
            expression.or([
              expression("role_permissions.deleted_at", "is", null),
              expression("role_permissions.id", "is", null),
            ]),
          )
          .where((expression) =>
            expression.or([
              expression("permissions.deleted_at", "is", null),
              expression("permissions.id", "is", null),
            ]),
          )
          .execute();
        const roles = [...new Set(rows.map((row) => row.role))];
        if (roles.length === 0) {
          throw new UnauthorizedException("Tenant account has no active role");
        }
        return {
          roles,
          permissions: [
            ...new Set(
              rows
                .map((row) => row.permission)
                .filter(
                  (permission): permission is string => permission !== null,
                ),
            ),
          ],
        };
      },
    );
  }
}
