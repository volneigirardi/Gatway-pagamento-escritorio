import { createZodDto } from "nestjs-zod";
import { auditLogQuerySchema, dashboardQuerySchema } from "@saas/contracts";

export class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
