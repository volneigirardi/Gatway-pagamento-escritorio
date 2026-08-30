import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "@saas/auth";
import {
  CurrentUser,
  PermissionGuard,
  RequirePermissions,
  TenantAuthGuard,
} from "../auth/auth.guard.js";
import { UpdateCompanySettingsDto } from "./tenant-portal.dto.js";
import { TenantPortalService } from "./tenant-portal.service.js";

@ApiTags("Tenant Portal")
@ApiBearerAuth()
@UseGuards(TenantAuthGuard, PermissionGuard)
@Controller({ path: "tenant", version: "1" })
export class TenantPortalController {
  constructor(private readonly portal: TenantPortalService) {}

  @Get("overview")
  @RequirePermissions("company:read", "subscription:read")
  async overview(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    return { data: await this.portal.overview(user) };
  }

  @Get("settings")
  @RequirePermissions("company:read")
  async settings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    return { data: await this.portal.settings(user) };
  }

  @Put("settings")
  @RequirePermissions("company:update")
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCompanySettingsDto,
  ): Promise<{ data: unknown }> {
    return { data: await this.portal.updateSettings(user, body) };
  }
}
