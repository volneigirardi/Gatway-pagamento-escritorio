import { Module } from "@nestjs/common";
import { PlatformIdempotencyService } from "../../common/platform-idempotency.service.js";
import { PlansController } from "./plans.controller.js";
import { PlansRepository } from "./plans.repository.js";
import { PlansService } from "./plans.service.js";

@Module({
  controllers: [PlansController],
  providers: [PlansRepository, PlansService, PlatformIdempotencyService],
  exports: [PlansRepository],
})
export class PlansModule {}
