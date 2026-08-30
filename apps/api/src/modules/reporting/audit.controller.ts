import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  PermissionGuard,
  PlatformAuthGuard,
  RequirePermissions,
} from "../auth/auth.guard.js";
import { AuditLogQueryDto } from "./reporting.dto.js";
import { ReportingService } from "./reporting.service.js";

@ApiTags("Platform Audit")
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PermissionGuard)
@Controller({ path: "platform/audit-logs", version: "1" })
export class AuditController {
  constructor(private readonly reporting: ReportingService) {}

  @Get()
  @RequirePermissions("platform:audit:read")
  async list(@Query() query: AuditLogQueryDto): Promise<{
    data: unknown;
    meta: { nextCursor: string | null };
  }> {
    const result = await this.reporting.auditLogs({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.action ? { action: query.action } : {}),
    });
    return { data: result.items, meta: { nextCursor: result.nextCursor } };
  }
}
