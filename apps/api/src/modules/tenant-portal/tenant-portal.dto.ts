import { createZodDto } from "nestjs-zod";
import { updateCompanySettingsRequestSchema } from "@saas/contracts";

export class UpdateCompanySettingsDto extends createZodDto(
  updateCompanySettingsRequestSchema,
) {}
