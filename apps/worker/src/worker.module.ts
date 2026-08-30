import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateWorkerConfig } from "@saas/config";
import { WorkerInfrastructure } from "./infrastructure.js";
import { PlatformOutboxRelay } from "./workers/platform-outbox.relay.js";
import { TenantProvisioningWorker } from "./workers/tenant-provisioning.worker.js";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (c) =>
        validateWorkerConfig(c as Record<string, string | undefined>),
    }),
  ],
  providers: [
    WorkerInfrastructure,
    PlatformOutboxRelay,
    TenantProvisioningWorker,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WorkerModule {}
