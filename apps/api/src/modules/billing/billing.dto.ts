import { createZodDto } from "nestjs-zod";
import {
  billingListQuerySchema,
  createInvoiceRequestSchema,
  recordPaymentRequestSchema,
} from "@saas/contracts";

export class CreateInvoiceDto extends createZodDto(
  createInvoiceRequestSchema,
) {}
export class RecordPaymentDto extends createZodDto(
  recordPaymentRequestSchema,
) {}
export class BillingListQueryDto extends createZodDto(billingListQuerySchema) {}
