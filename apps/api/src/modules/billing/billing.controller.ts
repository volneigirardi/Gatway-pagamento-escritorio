import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
  BillingListQueryDto,
  CreateInvoiceDto,
  RecordPaymentDto,
} from "./billing.dto.js";
import { BillingService } from "./billing.service.js";

@ApiTags("Platform Billing")
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PermissionGuard)
@Controller({ path: "platform/billing", version: "1" })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post("invoices")
  @HttpCode(201)
  @RequirePermissions("platform:billing:write")
  async createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: CreateInvoiceDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.billing.createInvoice(
      user,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Get("invoices")
  @RequirePermissions("platform:billing:read")
  async listInvoices(@Query() query: BillingListQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.billing.listInvoices(this.listQuery(query));
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }

  @Post("payments")
  @HttpCode(201)
  @RequirePermissions("platform:billing:write")
  async recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: RecordPaymentDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.billing.recordPayment(
      user,
      requireIdempotencyKey(idempotencyKey),
      body,
    );
    reply.header("idempotency-replayed", String(result.replayed));
    return { data: result.value };
  }

  @Get("payments")
  @RequirePermissions("platform:billing:read")
  async listPayments(@Query() query: BillingListQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.billing.listPayments(this.listQuery(query));
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }

  @Get("subscriptions")
  @RequirePermissions("platform:billing:read")
  async listSubscriptions(@Query() query: BillingListQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.billing.listSubscriptions(this.listQuery(query));
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }

  private listQuery(query: BillingListQueryDto): {
    limit: number;
    cursor?: string;
    tenantId?: string;
    status?: string;
    from?: string;
    to?: string;
  } {
    return {
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    };
  }
}
