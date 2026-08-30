import { createZodDto } from "nestjs-zod";
import {
  createTenantAdminRequestSchema,
  createTenantRequestSchema,
  cursorPageQuerySchema,
  updateTenantStatusRequestSchema,
} from "@saas/contracts";

export class CreateTenantDto extends createZodDto(createTenantRequestSchema) {}
export class CreateTenantAdminDto extends createZodDto(
  createTenantAdminRequestSchema,
) {}
export class TenantListQueryDto extends createZodDto(cursorPageQuerySchema) {}
export class UpdateTenantStatusDto extends createZodDto(
  updateTenantStatusRequestSchema,
) {}
