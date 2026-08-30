import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Argon2idPasswordHasher,
  decryptAuthSecret,
  encryptAuthSecret,
  JoseJwtIssuer,
  OtpAuthTotpService,
  validatePasswordPolicy,
  type AuthenticatedUser,
} from "@saas/auth";
import type { AuthUser } from "@saas/contracts";
import {
  AuthRepository,
  type AuditInput,
  type IdentityWithTenant,
} from "./auth.repository.js";
import {
  AuthSessionStore,
  type RefreshSessionMaterial,
} from "./auth-session.store.js";
import { TenantAuthorizationService } from "./tenant-authorization.service.js";

const maximumLoginAttempts = 5;
const loginAttemptWindowSeconds = 15 * 60;

export interface AuthRequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
}

export interface IssuedAuthSession {
  status: "authenticated";
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  csrfToken: string;
  user: AuthUser;
}

export type AuthFlowResult =
  | {
      status:
        "password_change_required" | "mfa_setup_required" | "mfa_required";
      challengeToken: string;
    }
  | IssuedAuthSession;

export interface MfaSetupResult {
  challengeToken: string;
  uri: string;
  secret: string;
}

export interface MfaConfirmationResult extends IssuedAuthSession {
  recoveryCodes: string[];
}

@Injectable()
export class AuthService {
  private readonly passwordHasher: Argon2idPasswordHasher;
  private readonly totp = new OtpAuthTotpService();
  private readonly jwtIssuer: JoseJwtIssuer;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly mfaEncryptionKey: Buffer;
  private readonly dummyHash: Promise<string>;

  constructor(
    config: ConfigService,
    private readonly repository: AuthRepository,
    private readonly sessions: AuthSessionStore,
    private readonly tenantAuthorization: TenantAuthorizationService,
  ) {
    this.passwordHasher = new Argon2idPasswordHasher(
      config.getOrThrow<number>("ARGON2_MEMORY_KIB"),
      config.getOrThrow<number>("ARGON2_ITERATIONS"),
      config.getOrThrow<number>("ARGON2_PARALLELISM"),
    );
    this.accessTokenTtlSeconds = config.getOrThrow<number>(
      "JWT_ACCESS_TOKEN_TTL_SECONDS",
    );
    this.refreshTokenTtlSeconds = config.getOrThrow<number>(
      "JWT_REFRESH_TOKEN_TTL_SECONDS",
    );
    this.mfaEncryptionKey = Buffer.from(
      config.getOrThrow<string>("MFA_ENCRYPTION_KEY"),
      "base64",
    );
    this.jwtIssuer = new JoseJwtIssuer(
      config.getOrThrow<string>("JWT_PRIVATE_KEY"),
      {
        issuer: config.getOrThrow<string>("JWT_ISSUER"),
        platformAudience: config.getOrThrow<string>("JWT_PLATFORM_AUDIENCE"),
        tenantAudience: config.getOrThrow<string>("JWT_TENANT_AUDIENCE"),
        keyId: config.getOrThrow<string>("JWT_KEY_ID"),
      },
    );
    this.dummyHash = this.passwordHasher.hash(
      "This is a timing-only password value 2026!",
    );
  }

  async login(
    email: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<AuthFlowResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const fingerprint = `${normalizedEmail}\u0000${context.ipAddress ?? "unknown"}`;
    if (await this.sessions.isLoginBlocked(fingerprint, maximumLoginAttempts)) {
      await this.audit(context, {
        action: "auth.login.blocked",
        resource: "authentication",
      });
      throw new HttpException("Too many authentication attempts", 429);
    }

    const identity =
      await this.repository.findIdentityByNormalizedEmail(normalizedEmail);
    const validPassword = await this.passwordHasher.verify(
      password,
      identity?.password_hash ?? (await this.dummyHash),
    );

    if (!identity || !validPassword || !this.canAuthenticate(identity)) {
      await this.sessions.recordLoginFailure(
        fingerprint,
        loginAttemptWindowSeconds,
      );
      await this.audit(context, {
        action: "auth.login.failed",
        resource: "authentication",
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.sessions.clearLoginFailures(fingerprint);
    const factor = await this.repository.getMfaFactor(identity.id);
    if (identity.must_change_password) {
      return {
        status: "password_change_required",
        challengeToken: await this.sessions.createChallenge({
          identityId: identity.id,
          stage: "password_change",
        }),
      };
    }
    if (identity.mfa_required && !factor?.enabled_at) {
      return {
        status: "mfa_setup_required",
        challengeToken: await this.sessions.createChallenge({
          identityId: identity.id,
          stage: "mfa_setup",
        }),
      };
    }
    if (factor?.enabled_at) {
      return {
        status: "mfa_required",
        challengeToken: await this.sessions.createChallenge({
          identityId: identity.id,
          stage: "mfa",
        }),
      };
    }
    return this.issueSession(identity, context);
  }

  async changePassword(
    challengeToken: string,
    newPassword: string,
    context: AuthRequestContext,
  ): Promise<AuthFlowResult> {
    const challenge = await this.requireChallenge(
      challengeToken,
      "password_change",
    );
    const identity = await this.requireIdentity(challenge.identityId);
    validatePasswordPolicy(newPassword);
    if (await this.passwordHasher.verify(newPassword, identity.password_hash)) {
      throw new BadRequestException(
        "New password must differ from the current password",
      );
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.repository.updatePassword(identity.id, passwordHash);
    await this.sessions.revokeIdentity(identity.id);
    await this.audit(context, {
      actorIdentityId: identity.id,
      action: "auth.password.changed",
      resource: "identity",
      resourceId: identity.id,
    });
    const factor = await this.repository.getMfaFactor(identity.id);
    return {
      status: factor?.enabled_at ? "mfa_required" : "mfa_setup_required",
      challengeToken: await this.sessions.createChallenge({
        identityId: identity.id,
        stage: factor?.enabled_at ? "mfa" : "mfa_setup",
      }),
    };
  }

  async setupMfa(challengeToken: string): Promise<MfaSetupResult> {
    const challenge = await this.requireChallenge(challengeToken, "mfa_setup");
    const identity = await this.requireIdentity(challenge.identityId);
    const secret = await this.totp.generateSecret();
    await this.repository.savePendingMfaFactor(
      identity.id,
      encryptAuthSecret(secret, this.mfaEncryptionKey),
    );
    return {
      challengeToken: await this.sessions.createChallenge({
        identityId: identity.id,
        stage: "mfa_confirm",
      }),
      uri: await this.totp.getUri(secret, identity.email, "Blupo"),
      secret,
    };
  }

  async confirmMfa(
    challengeToken: string,
    code: string,
    context: AuthRequestContext,
  ): Promise<MfaConfirmationResult> {
    const challenge = await this.requireChallenge(
      challengeToken,
      "mfa_confirm",
    );
    const identity = await this.requireIdentity(challenge.identityId);
    const factor = await this.repository.getMfaFactor(identity.id);
    if (!factor) throw new UnauthorizedException("Invalid MFA challenge");
    const secret = decryptAuthSecret(
      factor.secret_ciphertext,
      this.mfaEncryptionKey,
    );
    const step = await this.totp.verifyAndGetStep(code, secret);
    if (
      step === null ||
      !(await this.repository.consumeMfaStep(factor.id, step))
    ) {
      throw new UnauthorizedException("Invalid MFA code");
    }
    await this.repository.enableMfaFactor(factor.id);
    const recoveryCodes = await this.totp.generateBackupCodes();
    const recoveryHashes: string[] = [];
    for (const recoveryCode of recoveryCodes) {
      recoveryHashes.push(await this.passwordHasher.hash(recoveryCode));
    }
    await this.repository.replaceBackupCodes(factor.id, recoveryHashes);
    await this.repository.activateIdentity(identity.id);
    await this.audit(context, {
      actorIdentityId: identity.id,
      action: "auth.mfa.enrolled",
      resource: "identity",
      resourceId: identity.id,
    });
    const session = await this.issueSession(identity, context);
    return { ...session, recoveryCodes };
  }

  async verifyMfa(
    challengeToken: string,
    code: string,
    context: AuthRequestContext,
  ): Promise<IssuedAuthSession> {
    const challenge = await this.requireChallenge(challengeToken, "mfa");
    const identity = await this.requireIdentity(challenge.identityId);
    const factor = await this.repository.getMfaFactor(identity.id);
    if (!factor?.enabled_at) {
      throw new UnauthorizedException("Invalid MFA challenge");
    }
    const secret = decryptAuthSecret(
      factor.secret_ciphertext,
      this.mfaEncryptionKey,
    );
    const step = await this.totp.verifyAndGetStep(code, secret);
    if (
      step === null ||
      !(await this.repository.consumeMfaStep(factor.id, step))
    ) {
      throw new UnauthorizedException("Invalid MFA code");
    }
    await this.audit(context, {
      actorIdentityId: identity.id,
      action: "auth.mfa.verified",
      resource: "identity",
      resourceId: identity.id,
    });
    return this.issueSession(identity, context);
  }

  async verifyRecoveryCode(
    challengeToken: string,
    recoveryCode: string,
    context: AuthRequestContext,
  ): Promise<IssuedAuthSession> {
    const challenge = await this.requireChallenge(challengeToken, "mfa");
    const identity = await this.requireIdentity(challenge.identityId);
    const factor = await this.repository.getMfaFactor(identity.id);
    if (!factor?.enabled_at) {
      throw new UnauthorizedException("Invalid MFA challenge");
    }
    const codes = await this.repository.listUnusedBackupCodes(factor.id);
    let matchingCodeId: string | undefined;
    for (const candidate of codes) {
      if (
        await this.passwordHasher.verify(
          recoveryCode.toUpperCase(),
          candidate.codeHash,
        )
      ) {
        matchingCodeId = candidate.id;
        break;
      }
    }
    if (
      !matchingCodeId ||
      !(await this.repository.consumeBackupCode(matchingCodeId))
    ) {
      throw new UnauthorizedException("Invalid recovery code");
    }
    await this.audit(context, {
      actorIdentityId: identity.id,
      action: "auth.mfa.recovery_used",
      resource: "identity",
      resourceId: identity.id,
    });
    return this.issueSession(identity, context);
  }

  async refresh(
    refreshToken: string,
    csrfToken: string,
    context: AuthRequestContext,
  ): Promise<IssuedAuthSession> {
    const rotated = await this.sessions.rotateRefreshSession(
      refreshToken,
      csrfToken,
      this.refreshTokenTtlSeconds,
    );
    if (!rotated) throw new UnauthorizedException("Invalid session");
    const identity = await this.requireIdentity(rotated.previous.identityId);
    if (identity.must_change_password) {
      await this.sessions.revokeByToken(rotated.material.token);
      throw new UnauthorizedException("Invalid session");
    }
    const factor = await this.repository.getMfaFactor(identity.id);
    if (identity.mfa_required && !factor?.enabled_at) {
      await this.sessions.revokeByToken(rotated.material.token);
      throw new UnauthorizedException("Invalid session");
    }
    return this.issueSession(
      identity,
      context,
      {
        material: rotated.material,
        csrfToken: rotated.csrfToken,
      },
      "auth.refresh.succeeded",
    );
  }

  async logout(refreshToken: string, csrfToken: string): Promise<void> {
    if (!(await this.sessions.verifyRefreshCsrf(refreshToken, csrfToken))) {
      throw new UnauthorizedException("Invalid session");
    }
    await this.sessions.revokeByToken(refreshToken);
  }

  async currentUser(user: AuthenticatedUser): Promise<AuthUser> {
    const identity = await this.requireIdentity(user.userId);
    if (
      identity.realm !== user.realm ||
      (user.realm === "tenant" && identity.tenant_id !== user.tenantId)
    ) {
      throw new UnauthorizedException("Account is unavailable");
    }
    const authorization = await this.loadAuthorization(identity);
    const factor = await this.repository.getMfaFactor(identity.id);
    const shared = {
      id: identity.id,
      email: identity.email,
      roles: authorization.roles,
      permissions: authorization.permissions,
      mustChangePassword: identity.must_change_password,
      mfaEnabled: Boolean(factor?.enabled_at),
    };
    if (identity.realm === "platform") {
      return { ...shared, realm: "platform" };
    }
    if (!identity.tenant_id) {
      throw new UnauthorizedException("Tenant account is unavailable");
    }
    return { ...shared, realm: "tenant", tenantId: identity.tenant_id };
  }

  private canAuthenticate(identity: IdentityWithTenant): boolean {
    if (identity.status !== "active" && identity.status !== "pending") {
      return false;
    }
    if (identity.locked_until && identity.locked_until > new Date()) {
      return false;
    }
    return identity.realm === "platform" || identity.tenant_status === "active";
  }

  private async requireChallenge(
    challengeToken: string,
    expectedStage: "password_change" | "mfa_setup" | "mfa_confirm" | "mfa",
  ): Promise<{ identityId: string }> {
    const challenge = await this.sessions.consumeChallenge(challengeToken);
    if (challenge?.stage !== expectedStage) {
      throw new UnauthorizedException(
        "Authentication challenge is invalid or expired",
      );
    }
    return { identityId: challenge.identityId };
  }

  private async requireIdentity(
    identityId: string,
  ): Promise<IdentityWithTenant> {
    const identity = await this.repository.findIdentityById(identityId);
    if (!identity || !this.canAuthenticate(identity)) {
      throw new UnauthorizedException("Account is unavailable");
    }
    return identity;
  }

  private async loadAuthorization(identity: IdentityWithTenant): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    if (identity.realm === "platform") {
      return this.repository.loadPlatformAuthorization(identity.id);
    }
    if (!identity.tenant_id || !identity.tenant_database_name) {
      throw new UnauthorizedException("Tenant account is unavailable");
    }
    return this.tenantAuthorization.load({
      tenantId: identity.tenant_id,
      databaseName: identity.tenant_database_name,
      identityId: identity.id,
    });
  }

  private async issueSession(
    identity: IdentityWithTenant,
    context: AuthRequestContext,
    existingSession?: RefreshSessionMaterial,
    auditAction = "auth.login.succeeded",
  ): Promise<IssuedAuthSession> {
    const authorization = await this.loadAuthorization(identity);
    if (authorization.roles.length === 0) {
      throw new UnauthorizedException("Account has no active role");
    }
    const factor = await this.repository.getMfaFactor(identity.id);
    if (identity.mfa_required && !factor?.enabled_at) {
      throw new UnauthorizedException("MFA enrollment is required");
    }
    const session =
      existingSession ??
      (await this.sessions.createRefreshSession(
        identity.id,
        this.refreshTokenTtlSeconds,
      ));
    let authenticatedUser: AuthenticatedUser;
    let user: AuthUser;
    if (identity.realm === "platform") {
      authenticatedUser = {
        realm: "platform",
        userId: identity.id,
        roles: authorization.roles,
        permissions: authorization.permissions,
        tokenId: session.material.tokenId,
      };
      user = {
        id: identity.id,
        email: identity.email,
        realm: "platform",
        roles: authorization.roles,
        permissions: authorization.permissions,
        mustChangePassword: false,
        mfaEnabled: Boolean(factor?.enabled_at),
      };
    } else {
      const tenantId = identity.tenant_id;
      if (!tenantId) {
        throw new UnauthorizedException("Tenant account is unavailable");
      }
      authenticatedUser = {
        realm: "tenant",
        userId: identity.id,
        tenantId,
        roles: authorization.roles,
        permissions: authorization.permissions,
        tokenId: session.material.tokenId,
      };
      user = {
        id: identity.id,
        email: identity.email,
        realm: "tenant",
        tenantId,
        roles: authorization.roles,
        permissions: authorization.permissions,
        mustChangePassword: false,
        mfaEnabled: Boolean(factor?.enabled_at),
      };
    }
    const accessToken = await this.jwtIssuer.issue(
      authenticatedUser,
      this.accessTokenTtlSeconds,
    );
    if (auditAction === "auth.login.succeeded") {
      await this.repository.recordSuccessfulLogin(identity.id);
    }
    await this.audit(context, {
      actorIdentityId: identity.id,
      action: auditAction,
      resource: "authentication",
      resourceId: identity.id,
    });
    return {
      status: "authenticated",
      accessToken,
      expiresInSeconds: this.accessTokenTtlSeconds,
      refreshToken: session.material.token,
      csrfToken: session.csrfToken,
      user,
    };
  }

  private async audit(
    context: AuthRequestContext,
    input: Omit<
      AuditInput,
      "ipAddress" | "userAgent" | "requestId" | "correlationId"
    >,
  ): Promise<void> {
    await this.repository.appendAudit({
      ...input,
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.correlationId
        ? { correlationId: context.correlationId }
        : {}),
    });
  }
}
