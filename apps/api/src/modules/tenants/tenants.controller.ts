import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { AuthenticatedUser } from "@saas/auth";
import { requireIdempotencyKey } from "../../common/platform-idempotency.service.js";
import {
  CurrentUser,
  PermissionGuard,
  PlatformAuthGuard,
  RequirePermissions,
} from "../auth/auth.guard.js";
import {
  CreateTenantAdminDto,
  CreateTenantDto,
  TenantListQueryDto,
  UpdateTenantStatusDto,
} from "./tenants.dto.js";
import { TenantsService } from "./tenants.service.js";

@ApiTags("Platform Tenants")
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PermissionGuard)
@Controller({ path: "platform/tenants", version: "1" })
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions("platform:tenants:write")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreateTenantDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.tenants.create(
      user,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Get()
  @RequirePermissions("platform:tenants:read")
  async list(@Query() query: TenantListQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.tenants.list({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }

  @Patch(":tenantId/status")
  @RequirePermissions("platform:tenants:write")
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId", new ParseUUIDPipe({ version: "4" })) tenantId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: UpdateTenantStatusDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.tenants.updateStatus(
      user,
      tenantId,
      requireIdempotencyKey(idempotencyKey),
      body.status,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Post(":tenantId/provisioning/retry")
  @HttpCode(202)
  @RequirePermissions("platform:tenants:write")
  async retryProvisioning(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId", new ParseUUIDPipe({ version: "4" })) tenantId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.tenants.retryProvisioning(
      user,
      tenantId,
      requireIdempotencyKey(idempotencyKey),
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Get(":tenantId")
  @RequirePermissions("platform:tenants:read")
  async get(
    @Param("tenantId", new ParseUUIDPipe({ version: "4" })) tenantId: string,
  ): Promise<{ data: unknown }> {
    return { data: await this.tenants.get(tenantId) };
  }

  @Post(":tenantId/administrator")
  @HttpCode(202)
  @RequirePermissions("platform:tenants:write")
  async createAdministrator(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId", new ParseUUIDPipe({ version: "4" })) tenantId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreateTenantAdminDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.tenants.createAdministrator(
      user,
      tenantId,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }
}
