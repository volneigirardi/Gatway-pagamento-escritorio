import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { ReportingController } from "./reporting.controller.js";
import { ReportingRepository } from "./reporting.repository.js";
import { ReportingService } from "./reporting.service.js";

@Module({
  controllers: [ReportingController, AuditController],
  providers: [ReportingRepository, ReportingService],
})
export class ReportingModule {}
