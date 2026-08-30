import { createZodDto } from "nestjs-zod";
import {
  loginRequestSchema,
  mfaRecoveryRequestSchema,
  mfaVerifyRequestSchema,
  passwordChangeRequestSchema,
  authChallengeSchema,
} from "@saas/contracts";

export class LoginDto extends createZodDto(loginRequestSchema) {}
export class PasswordChangeDto extends createZodDto(
  passwordChangeRequestSchema,
) {}
export class AuthChallengeDto extends createZodDto(authChallengeSchema) {}
export class MfaVerifyDto extends createZodDto(mfaVerifyRequestSchema) {}
export class MfaRecoveryDto extends createZodDto(mfaRecoveryRequestSchema) {}
