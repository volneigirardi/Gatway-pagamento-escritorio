import { Module } from "@nestjs/common";
import { TenantPortalController } from "./tenant-portal.controller.js";
import { TenantPortalService } from "./tenant-portal.service.js";

@Module({
  controllers: [TenantPortalController],
  providers: [TenantPortalService],
})
export class TenantPortalModule {}
