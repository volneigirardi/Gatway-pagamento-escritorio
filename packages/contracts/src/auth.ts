import { z } from "zod";

export const authRealmSchema = z.enum(["platform", "tenant"]);

const authUserBaseSchema = z.object({
  id: z.uuid(),
  email: z.email().max(320),
  realm: authRealmSchema,
  roles: z.array(z.string().min(1).max(64)).max(32),
  permissions: z.array(z.string().min(1).max(128)).max(256),
  mustChangePassword: z.boolean(),
  mfaEnabled: z.boolean(),
});

export const authUserSchema = z.discriminatedUnion("realm", [
  authUserBaseSchema.extend({ realm: z.literal("platform") }).strict(),
  authUserBaseSchema
    .extend({ realm: z.literal("tenant"), tenantId: z.uuid() })
    .strict(),
]);

export const loginRequestSchema = z
  .object({
    email: z.email().max(320),
    password: z.string().min(1).max(128),
  })
  .strict();

export const authChallengeSchema = z
  .object({
    challengeToken: z.string().min(32).max(512),
  })
  .strict();

export const passwordChangeRequestSchema = authChallengeSchema
  .extend({
    newPassword: z.string().min(12).max(128),
  })
  .strict();

export const mfaVerifyRequestSchema = authChallengeSchema
  .extend({
    code: z.string().regex(/^\d{6}$/u),
  })
  .strict();

export const mfaRecoveryRequestSchema = authChallengeSchema
  .extend({
    recoveryCode: z.string().regex(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/u),
  })
  .strict();

export const authSessionSchema = z
  .object({
    status: z.literal("authenticated"),
    accessToken: z.string().min(1),
    expiresInSeconds: z.number().int().min(60).max(3600),
    csrfToken: z.string().min(32).max(512),
    user: authUserSchema,
  })
  .strict();

export const authStepSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("password_change_required"),
      challengeToken: z.string().min(32).max(512),
    })
    .strict(),
  z
    .object({
      status: z.literal("mfa_setup_required"),
      challengeToken: z.string().min(32).max(512),
    })
    .strict(),
  z
    .object({
      status: z.literal("mfa_required"),
      challengeToken: z.string().min(32).max(512),
    })
    .strict(),
  authSessionSchema,
]);

export const mfaSetupSchema = z
  .object({
    challengeToken: z.string().min(32).max(512),
    uri: z.string().startsWith("otpauth://"),
    secret: z.string().regex(/^[A-Z2-7]{32}$/u),
  })
  .strict();

export const mfaConfirmationSchema = authSessionSchema.extend({
  recoveryCodes: z.array(z.string().regex(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/u)),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthStep = z.infer<typeof authStepSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
