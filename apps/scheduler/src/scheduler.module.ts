import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateSchedulerConfig } from "@saas/config";
import { ExampleScheduler } from "./schedulers/example.scheduler.js";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (c) =>
        validateSchedulerConfig(c as Record<string, string | undefined>),
    }),
  ],
  providers: [ExampleScheduler],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SchedulerModule {}
