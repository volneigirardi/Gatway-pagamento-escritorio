import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const moneyCentsSchema = z.number().int().min(0).max(1_000_000_000_000);

function validTaxId(value: string): boolean {
  if (!/^\d{14}$/u.test(value) || /^(\d)\1{13}$/u.test(value)) return false;
  const digits = [...value].map(Number);
  const check = (weights: number[]): number => {
    const sum = weights.reduce(
      (total, weight, index) => total + (digits[index] ?? 0) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    digits[12] === check([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    digits[13] === check([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  );
}

export const planFeatureValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().max(500),
]);

export const createPlanRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().max(2000).optional(),
    trialDays: z.number().int().min(0).max(365).default(0),
    price: z
      .object({
        currency: z.literal("BRL").default("BRL"),
        billingInterval: z.enum(["monthly", "yearly"]),
        amountCents: moneyCentsSchema,
      })
      .strict(),
    features: z.record(
      z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/u),
      planFeatureValueSchema,
    ),
  })
  .strict();

export const updatePlanRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one plan field is required",
  });

export const createPlanPriceRequestSchema = z
  .object({
    currency: z.literal("BRL").default("BRL"),
    billingInterval: z.enum(["monthly", "yearly"]),
    amountCents: moneyCentsSchema,
    effectiveFrom: z.iso.datetime().optional(),
  })
  .strict();

export const planPriceSchema = z
  .object({
    id: z.uuid(),
    currency: z.string().length(3),
    billingInterval: z.enum(["monthly", "yearly"]),
    amountCents: moneyCentsSchema,
    effectiveFrom: z.iso.datetime(),
    effectiveTo: z.iso.datetime().nullable(),
  })
  .strict();

export const planSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    status: z.enum(["draft", "active", "archived"]),
    trialDays: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    prices: z.array(planPriceSchema),
    features: z.record(z.string(), planFeatureValueSchema),
  })
  .strict();

export const createTenantRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(255),
    slug: slugSchema,
    legalName: z.string().trim().min(2).max(255).optional(),
    tradeName: z.string().trim().min(2).max(255).optional(),
    taxId: z
      .string()
      .regex(/^\d{14}$/u)
      .refine(validTaxId, { message: "Invalid CNPJ" })
      .optional(),
    contactEmail: z.email().max(320),
    planId: z.uuid(),
    planPriceId: z.uuid(),
  })
  .strict();

export const createTenantAdminRequestSchema = z
  .object({
    email: z.email().max(320),
    temporaryPassword: z.string().min(12).max(128),
    displayName: z.string().trim().min(2).max(160),
  })
  .strict();

export const updateTenantStatusRequestSchema = z
  .object({ status: z.enum(["active", "suspended"]) })
  .strict();

export const tenantSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    legalName: z.string().nullable(),
    tradeName: z.string().nullable(),
    taxId: z.string().nullable(),
    contactEmail: z.string().nullable(),
    status: z.enum([
      "draft",
      "provisioning",
      "pending_admin",
      "active",
      "suspended",
      "failed",
      "archived",
    ]),
    provisioningStatus: z.enum([
      "not_started",
      "queued",
      "running",
      "completed",
      "failed",
    ]),
    planId: z.uuid().nullable(),
    activatedAt: z.iso.datetime().nullable(),
    suspendedAt: z.iso.datetime().nullable(),
    lastErrorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const cursorPageQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).optional(),
    status: z.string().max(30).optional(),
  })
  .strict();

export type Plan = z.infer<typeof planSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;
export type CreatePlanPriceRequest = z.infer<
  typeof createPlanPriceRequestSchema
>;
export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type CreateTenantAdminRequest = z.infer<
  typeof createTenantAdminRequestSchema
>;
export type UpdateTenantStatusRequest = z.infer<
  typeof updateTenantStatusRequestSchema
>;
