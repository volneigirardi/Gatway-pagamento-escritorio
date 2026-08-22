import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HealthModule {
  static readonly moduleName = "health";
}
