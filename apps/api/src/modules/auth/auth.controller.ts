import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "@saas/auth";
import { getRequestContext } from "@saas/observability";
import { AccessTokenGuard, CurrentUser } from "./auth.guard.js";
import {
  AuthChallengeDto,
  LoginDto,
  MfaRecoveryDto,
  MfaVerifyDto,
  PasswordChangeDto,
} from "./auth.dto.js";
import {
  AuthService,
  type AuthRequestContext,
  type IssuedAuthSession,
  type MfaConfirmationResult,
} from "./auth.service.js";

@ApiTags("Authentication")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  private readonly refreshCookieName: string;
  private readonly refreshTtlSeconds: number;
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secureCookies = config.getOrThrow<string>("NODE_ENV") === "production";
    this.refreshCookieName = this.secureCookies
      ? "__Host-blupo_refresh"
      : "blupo_refresh";
    this.refreshTtlSeconds = config.getOrThrow<number>(
      "JWT_REFRESH_TOKEN_TTL_SECONDS",
    );
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.auth.login(
      body.email,
      body.password,
      this.requestContext(request),
    );
    return result.status === "authenticated"
      ? this.sessionResponse(result, reply)
      : { data: result };
  }

  @Post("password/change")
  @HttpCode(200)
  async changePassword(
    @Body() body: PasswordChangeDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.auth.changePassword(
      body.challengeToken,
      body.newPassword,
      this.requestContext(request),
    );
    return result.status === "authenticated"
      ? this.sessionResponse(result, reply)
      : { data: result };
  }

  @Post("mfa/setup")
  @HttpCode(200)
  async setupMfa(@Body() body: AuthChallengeDto): Promise<{ data: unknown }> {
    return { data: await this.auth.setupMfa(body.challengeToken) };
  }

  @Post("mfa/confirm")
  @HttpCode(200)
  async confirmMfa(
    @Body() body: MfaVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.auth.confirmMfa(
      body.challengeToken,
      body.code,
      this.requestContext(request),
    );
    return this.sessionResponse(result, reply);
  }

  @Post("mfa/verify")
  @HttpCode(200)
  async verifyMfa(
    @Body() body: MfaVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.auth.verifyMfa(
      body.challengeToken,
      body.code,
      this.requestContext(request),
    );
    return this.sessionResponse(result, reply);
  }

  @Post("mfa/recovery")
  @HttpCode(200)
  async verifyRecoveryCode(
    @Body() body: MfaRecoveryDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const result = await this.auth.verifyRecoveryCode(
      body.challengeToken,
      body.recoveryCode,
      this.requestContext(request),
    );
    return this.sessionResponse(result, reply);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: unknown }> {
    const refreshToken = this.requireRefreshCookie(request, reply);
    const csrfToken = this.requireCsrfHeader(request);
    const result = await this.auth.refresh(
      refreshToken,
      csrfToken,
      this.requestContext(request),
    );
    return this.sessionResponse(result, reply);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = this.requireRefreshCookie(request, reply);
    const csrfToken = this.requireCsrfHeader(request);
    await this.auth.logout(refreshToken, csrfToken);
    reply.clearCookie(this.refreshCookieName, {
      path: "/",
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "strict",
    });
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    return { data: await this.auth.currentUser(user) };
  }

  private sessionResponse(
    result: IssuedAuthSession | MfaConfirmationResult,
    reply: FastifyReply,
  ): { data: unknown } {
    reply.setCookie(this.refreshCookieName, result.refreshToken, {
      path: "/",
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "strict",
      maxAge: this.refreshTtlSeconds,
      signed: true,
    });
    const { refreshToken: _refreshToken, ...data } = result;
    return { data };
  }

  private requireRefreshCookie(
    request: FastifyRequest,
    reply: FastifyReply,
  ): string {
    const signedToken = request.cookies[this.refreshCookieName];
    if (!signedToken) {
      throw new UnauthorizedException("Refresh session required");
    }
    const token = reply.unsignCookie(signedToken);
    if (!token.valid || !token.value) {
      throw new UnauthorizedException("Invalid refresh cookie");
    }
    return token.value;
  }

  private requireCsrfHeader(request: FastifyRequest): string {
    const token = request.headers["x-csrf-token"];
    if (typeof token !== "string" || token.length < 32 || token.length > 512) {
      throw new UnauthorizedException("CSRF token required");
    }
    return token;
  }

  private requestContext(request: FastifyRequest): AuthRequestContext {
    const context = getRequestContext();
    const userAgent = request.headers["user-agent"];
    return {
      ipAddress: request.ip,
      ...(typeof userAgent === "string" ? { userAgent } : {}),
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.correlationId
        ? { correlationId: context.correlationId }
        : {}),
    };
  }
}
