import { createZodDto } from "nestjs-zod";
import {
  createPlanPriceRequestSchema,
  createPlanRequestSchema,
  cursorPageQuerySchema,
  updatePlanRequestSchema,
} from "@saas/contracts";

export class CreatePlanDto extends createZodDto(createPlanRequestSchema) {}
export class UpdatePlanDto extends createZodDto(updatePlanRequestSchema) {}
export class CreatePlanPriceDto extends createZodDto(
  createPlanPriceRequestSchema,
) {}
export class PlanListQueryDto extends createZodDto(cursorPageQuerySchema) {}
