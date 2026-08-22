import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateConfig } from "@saas/config";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { HealthModule } from "./health/health.module.js";
import { VersionModule } from "./version/version.module.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: (c) => validateConfig(c as Record<string, string | undefined>),
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 100,
      },
    ]),
    HealthModule,
    VersionModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
