import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateConfig } from "@saas/config";
import { EventsGateway } from "./events/events.gateway.js";
import { HealthModule } from "./health/health.module.js";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (c) => validateConfig(c as Record<string, string | undefined>),
    }),
    HealthModule,
  ],
  providers: [EventsGateway],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
