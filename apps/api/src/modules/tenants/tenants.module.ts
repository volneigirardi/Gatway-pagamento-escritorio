import { Module } from "@nestjs/common";
import { PlatformIdempotencyService } from "../../common/platform-idempotency.service.js";
import { TenantsController } from "./tenants.controller.js";
import { TenantsRepository } from "./tenants.repository.js";
import { TenantsService } from "./tenants.service.js";

@Module({
  controllers: [TenantsController],
  providers: [TenantsRepository, TenantsService, PlatformIdempotencyService],
  exports: [TenantsRepository],
})
export class TenantsModule {}
