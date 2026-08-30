import {
  createParamDecorator,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JoseJwtVerifier, type AuthenticatedUser } from "@saas/auth";
import type { FastifyRequest } from "fastify";

const permissionsMetadataKey = "blupo:required-permissions";

export interface AuthenticatedRequest extends FastifyRequest {
  authUser?: AuthenticatedUser;
}

@Injectable()
export class AccessTokenVerifierService {
  private readonly verifier: JoseJwtVerifier;

  constructor(config: ConfigService) {
    this.verifier = new JoseJwtVerifier(
      config.getOrThrow<string>("JWT_PUBLIC_KEY"),
      {
        issuer: config.getOrThrow<string>("JWT_ISSUER"),
        platformAudience: config.getOrThrow<string>("JWT_PLATFORM_AUDIENCE"),
        tenantAudience: config.getOrThrow<string>("JWT_TENANT_AUDIENCE"),
        keyId: config.getOrThrow<string>("JWT_KEY_ID"),
      },
    );
  }

  verify(token: string): Promise<AuthenticatedUser | null> {
    return this.verifier.verify(token);
  }

  async authenticate(
    context: ExecutionContext,
    realm?: "platform" | "tenant",
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }
    const user = await this.verifier.verify(authorization.slice(7));
    if (!user) throw new UnauthorizedException("Invalid access token");
    if (realm && user.realm !== realm) {
      throw new ForbiddenException("Forbidden authorization realm");
    }
    request.authUser = user;
    return true;
  }
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly verifier: AccessTokenVerifierService) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return this.verifier.authenticate(context);
  }
}

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly verifier: AccessTokenVerifierService) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return this.verifier.authenticate(context, "platform");
  }
}

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(private readonly verifier: AccessTokenVerifierService) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return this.verifier.authenticate(context, "tenant");
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      permissionsMetadataKey,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    if (!user) throw new UnauthorizedException("Authentication required");
    if (
      !required.every((permission) => user.permissions.includes(permission))
    ) {
      throw new ForbiddenException("Insufficient permission");
    }
    return true;
  }
}

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(permissionsMetadataKey, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new UnauthorizedException("Authentication required");
    }
    return request.authUser;
  },
);
