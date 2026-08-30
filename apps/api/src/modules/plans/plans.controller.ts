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
  CreatePlanDto,
  CreatePlanPriceDto,
  PlanListQueryDto,
  UpdatePlanDto,
} from "./plans.dto.js";
import { PlansService } from "./plans.service.js";

@ApiTags("Platform Plans")
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PermissionGuard)
@Controller({ path: "platform/plans", version: "1" })
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions("platform:plans:write")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreatePlanDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.plans.create(
      user,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Get()
  @RequirePermissions("platform:plans:read")
  async list(@Query() query: PlanListQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.plans.list({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }

  @Get(":planId")
  @RequirePermissions("platform:plans:read")
  async get(
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
  ): Promise<{ data: unknown }> {
    return { data: await this.plans.get(planId) };
  }

  @Patch(":planId")
  @RequirePermissions("platform:plans:write")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: UpdatePlanDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.plans.update(
      user,
      planId,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Post(":planId/prices")
  @RequirePermissions("platform:plans:write")
  async addPrice(
    @CurrentUser() user: AuthenticatedUser,
    @Param("planId", new ParseUUIDPipe({ version: "4" })) planId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreatePlanPriceDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.plans.addPrice(
      user,
      planId,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }
}
