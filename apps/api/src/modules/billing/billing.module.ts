import { Module } from "@nestjs/common";
import { PlatformIdempotencyService } from "../../common/platform-idempotency.service.js";
import { BillingController } from "./billing.controller.js";
import { BillingRepository } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";

@Module({
  controllers: [BillingController],
  providers: [BillingRepository, BillingService, PlatformIdempotencyService],
  exports: [BillingRepository],
})
export class BillingModule {}
