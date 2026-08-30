import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateApiConfig } from "@saas/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { HealthModule } from "./health/health.module.js";
import { VersionModule } from "./version/version.module.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { DatabaseModule } from "./common/database.module.js";
import { RedisModule, RedisService } from "./common/redis.module.js";
import { RedisThrottlerStorage } from "./common/redis-throttler.storage.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { PlansModule } from "./modules/plans/plans.module.js";
import { TenantsModule } from "./modules/tenants/tenants.module.js";
import { BillingModule } from "./modules/billing/billing.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { TenantPortalModule } from "./modules/tenant-portal/tenant-portal.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: (c) =>
        validateApiConfig(c as Record<string, string | undefined>),
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService, ConfigService],
      useFactory: (redis: RedisService, config: ConfigService) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            name: "default",
            ttl: config.getOrThrow<number>("RATE_LIMIT_TTL_MS"),
            limit: config.getOrThrow<number>("RATE_LIMIT_MAX_REQUESTS"),
          },
        ],
      }),
    }),
    DatabaseModule,
    AuthModule,
    PlansModule,
    TenantsModule,
    BillingModule,
    ReportingModule,
    TenantPortalModule,
    HealthModule,
    VersionModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
