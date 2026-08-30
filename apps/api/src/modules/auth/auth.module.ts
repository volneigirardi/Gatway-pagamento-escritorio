import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import {
  AccessTokenGuard,
  AccessTokenVerifierService,
  PermissionGuard,
  PlatformAuthGuard,
  TenantAuthGuard,
} from "./auth.guard.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthSessionStore } from "./auth-session.store.js";
import { AuthService } from "./auth.service.js";
import { TenantAuthorizationService } from "./tenant-authorization.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthSessionStore,
    TenantAuthorizationService,
    AuthService,
    AccessTokenVerifierService,
    AccessTokenGuard,
    PlatformAuthGuard,
    TenantAuthGuard,
    PermissionGuard,
  ],
  exports: [
    AuthService,
    AccessTokenVerifierService,
    AccessTokenGuard,
    PlatformAuthGuard,
    TenantAuthGuard,
    PermissionGuard,
  ],
})
export class AuthModule {}
