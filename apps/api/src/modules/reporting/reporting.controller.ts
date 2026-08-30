import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  PermissionGuard,
  PlatformAuthGuard,
  RequirePermissions,
} from "../auth/auth.guard.js";
import { DashboardQueryDto } from "./reporting.dto.js";
import { ReportingService } from "./reporting.service.js";

@ApiTags("Platform Dashboard")
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PermissionGuard)
@Controller({ path: "platform/dashboard", version: "1" })
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get()
  @RequirePermissions("platform:dashboard:read")
  async dashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<{ data: unknown }> {
    return { data: await this.reporting.dashboard(query.period) };
  }
}
