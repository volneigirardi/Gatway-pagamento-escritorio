import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "@saas/auth";
import { Argon2idPasswordHasher, validatePasswordPolicy } from "@saas/auth";
import type {
  CreateTenantAdminRequest,
  CreateTenantRequest,
  UpdateTenantStatusRequest,
} from "@saas/contracts";
import type { Transaction } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { decodeCursor, encodeCursor } from "../../common/cursor.js";
import {
  PlatformIdempotencyService,
  type IdempotentResult,
} from "../../common/platform-idempotency.service.js";
import { TenantsRepository, type TenantRow } from "./tenants.repository.js";

const tenantStatuses = [
  "draft",
  "provisioning",
  "pending_admin",
  "active",
  "suspended",
  "failed",
  "archived",
] as const;

function tenantResponse(tenant: TenantRow): Record<string, unknown> {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    legalName: tenant.legal_name,
    tradeName: tenant.trade_name,
    taxId: tenant.tax_id,
    contactEmail: tenant.contact_email,
    status: tenant.status,
    provisioningStatus: tenant.provisioning_status,
    planId: tenant.plan_id,
    activatedAt: tenant.activated_at?.toISOString() ?? null,
    suspendedAt: tenant.suspended_at?.toISOString() ?? null,
    lastErrorCode: tenant.last_error_code,
    createdAt: tenant.created_at.toISOString(),
    updatedAt: tenant.updated_at.toISOString(),
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
export class TenantsService {
  private readonly passwordHasher: Argon2idPasswordHasher;

  constructor(
    config: ConfigService,
    private readonly repository: TenantsRepository,
    private readonly idempotency: PlatformIdempotencyService,
  ) {
    this.passwordHasher = new Argon2idPasswordHasher(
      config.getOrThrow<number>("ARGON2_MEMORY_KIB"),
      config.getOrThrow<number>("ARGON2_ITERATIONS"),
      config.getOrThrow<number>("ARGON2_PARALLELISM"),
    );
  }

  async create(
    user: AuthenticatedUser,
    key: string,
    input: CreateTenantRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    try {
      return await this.idempotency.execute({
        scope: "platform.tenants.create",
        key,
        actorIdentityId: user.userId,
        request: input,
        callback: async (transaction) => {
          const plan = await this.repository.getPlanSelection(
            input.planId,
            input.planPriceId,
            transaction,
          );
          if (plan?.planStatus !== "active") {
            throw new BadRequestException("Active plan and price are required");
          }
          const tenant = await this.repository.create(transaction, {
            name: input.name,
            slug: input.slug,
            ...(input.legalName ? { legalName: input.legalName } : {}),
            ...(input.tradeName ? { tradeName: input.tradeName } : {}),
            ...(input.taxId ? { taxId: input.taxId } : {}),
            contactEmail: input.contactEmail,
            createdByIdentityId: user.userId,
            plan,
          });
          await this.recordMutation(
            transaction,
            user.userId,
            "tenant.provisioning.requested",
            tenant.id,
            { tenantId: tenant.id },
          );
          return tenantResponse(tenant);
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Tenant slug, tax ID, or identity already exists",
        );
      }
      throw error;
    }
  }

  async createAdministrator(
    user: AuthenticatedUser,
    tenantId: string,
    key: string,
    input: CreateTenantAdminRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    validatePasswordPolicy(input.temporaryPassword);
    try {
      return await this.idempotency.execute({
        scope: `platform.tenants.admin.create:${tenantId}`,
        key,
        actorIdentityId: user.userId,
        request: {
          tenantId,
          email: input.email.toLowerCase(),
          displayName: input.displayName,
        },
        callback: async (transaction) => {
          const tenant = await this.repository.findByIdForUpdate(
            transaction,
            tenantId,
          );
          if (
            tenant?.status !== "pending_admin" ||
            tenant.provisioning_status !== "completed"
          ) {
            throw new ConflictException(
              "Tenant must complete database provisioning first",
            );
          }
          if (await this.repository.hasTenantIdentity(transaction, tenantId)) {
            throw new ConflictException(
              "Tenant initial administrator already exists",
            );
          }
          const passwordHash = await this.passwordHasher.hash(
            input.temporaryPassword,
          );
          const identityId = await this.repository.createAdminIdentity(
            transaction,
            {
              tenantId,
              email: input.email.trim().toLowerCase(),
              displayName: input.displayName,
              passwordHash,
            },
          );
          const value = { tenantId, identityId, status: "pending_activation" };
          await this.recordMutation(
            transaction,
            user.userId,
            "tenant.admin.provisioning.requested",
            tenantId,
            { tenantId, identityId },
          );
          return value;
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Administrator email already exists");
      }
      throw error;
    }
  }

  async updateStatus(
    user: AuthenticatedUser,
    tenantId: string,
    key: string,
    status: UpdateTenantStatusRequest["status"],
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    return this.idempotency.execute({
      scope: `platform.tenants.status.update:${tenantId}`,
      key,
      actorIdentityId: user.userId,
      request: { tenantId, status },
      callback: async (transaction) => {
        const tenant = await this.repository.findByIdForUpdate(
          transaction,
          tenantId,
        );
        if (!tenant) throw new NotFoundException("Tenant not found");
        if (tenant.status === status) return tenantResponse(tenant);
        const allowedTransition =
          (tenant.status === "active" && status === "suspended") ||
          (tenant.status === "suspended" && status === "active");
        if (!allowedTransition) {
          throw new ConflictException("Invalid tenant status transition");
        }
        const updated = await this.repository.update(transaction, tenantId, {
          status,
          suspended_at: status === "suspended" ? new Date() : null,
        });
        if (!updated) throw new NotFoundException("Tenant not found");
        await this.recordMutation(
          transaction,
          user.userId,
          status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
          tenantId,
          { tenantId, status },
        );
        return tenantResponse(updated);
      },
    });
  }

  async retryProvisioning(
    user: AuthenticatedUser,
    tenantId: string,
    key: string,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    return this.idempotency.execute({
      scope: `platform.tenants.provisioning.retry:${tenantId}`,
      key,
      actorIdentityId: user.userId,
      request: { tenantId },
      callback: async (transaction) => {
        const tenant = await this.repository.findById(tenantId, transaction);
        if (!tenant) throw new NotFoundException("Tenant not found");
        if (tenant.status !== "failed") {
          throw new ConflictException(
            "Only failed provisioning can be retried",
          );
        }
        const updated = await this.repository.update(transaction, tenantId, {
          status: "provisioning",
          provisioning_status: "queued",
          last_error_code: null,
        });
        if (!updated) throw new NotFoundException("Tenant not found");
        await this.recordMutation(
          transaction,
          user.userId,
          "tenant.provisioning.requested",
          tenantId,
          { tenantId },
        );
        return tenantResponse(updated);
      },
    });
  }

  async list(input: {
    limit: number;
    cursor?: string;
    search?: string;
    status?: string;
  }): Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }> {
    const status = input.status;
    if (
      status &&
      !tenantStatuses.includes(status as (typeof tenantStatuses)[number])
    ) {
      throw new BadRequestException("Invalid tenant status");
    }
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.list({
      limit: input.limit,
      ...(input.search ? { search: input.search } : {}),
      ...(status ? { status: status as (typeof tenantStatuses)[number] } : {}),
      ...(before ? { before } : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(tenantResponse),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null,
    };
  }

  async get(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenantResponse(tenant);
  }

  private async recordMutation(
    transaction: Transaction<AdminDatabase>,
    actorIdentityId: string,
    eventType: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await transaction
      .insertInto("platform_outbox")
      .values({
        aggregate_type: "Tenant",
        aggregate_id: tenantId,
        event_type: eventType,
        payload,
      })
      .execute();
    await transaction
      .insertInto("platform_audit_logs")
      .values({
        actor_identity_id: actorIdentityId,
        action: eventType,
        resource: "tenant",
        resource_id: tenantId,
        tenant_id: tenantId,
        metadata: payload,
      })
      .execute();
  }
}
