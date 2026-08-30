import { z } from "zod";

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone");

const localeSchema = z
  .string()
  .regex(/^[a-z]{2}-[A-Z]{2}$/u)
  .refine((locale) => {
    try {
      return Intl.getCanonicalLocales(locale).length === 1;
    } catch {
      return false;
    }
  }, "Invalid locale");

export const updateCompanySettingsRequestSchema = z
  .object({
    legalName: z.string().trim().min(2).max(160).nullable(),
    tradeName: z.string().trim().min(2).max(120).nullable(),
    contactEmail: z.email().max(320).nullable(),
    timezone: timezoneSchema,
    locale: localeSchema,
  })
  .strict();

export const companySettingsSchema = z
  .object({
    id: z.uuid(),
    legalName: z.string().nullable(),
    tradeName: z.string().nullable(),
    taxId: z.string().nullable(),
    contactEmail: z.string().nullable(),
    timezone: timezoneSchema,
    locale: localeSchema,
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const tenantOverviewSchema = z
  .object({
    settings: companySettingsSchema,
    activeUsers: z.number().int().min(0),
    currentUser: z
      .object({ displayName: z.string(), email: z.email() })
      .strict(),
    subscription: z
      .object({
        planName: z.string(),
        status: z.string(),
        billingInterval: z.enum(["monthly", "yearly"]),
        amountCents: z.number().int().min(0),
        currency: z.string().length(3),
        currentPeriodEnd: z.iso.datetime(),
        trialEndsAt: z.iso.datetime().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type CompanySettings = z.infer<typeof companySettingsSchema>;
export type TenantOverview = z.infer<typeof tenantOverviewSchema>;
export type UpdateCompanySettingsRequest = z.infer<
  typeof updateCompanySettingsRequestSchema
>;
