import {
  Global,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { closeKysely, createKysely } from "@saas/database";
import type { Kysely } from "kysely";
import type { AdminDatabase } from "./admin-database.js";
import { TenantDatabaseManager } from "./tenant-database.manager.js";

@Injectable()
export class AdminDatabaseService implements OnApplicationShutdown {
  readonly db: Kysely<AdminDatabase>;

  constructor(config: ConfigService) {
    this.db = createKysely<AdminDatabase>({
      connectionString: config.getOrThrow<string>("DATABASE_URL"),
      poolMin: config.get<number>("DATABASE_POOL_MIN") ?? 1,
      poolMax: config.get<number>("DATABASE_POOL_MAX") ?? 5,
      queryTimeout: config.get<number>("DATABASE_TIMEOUT") ?? 30000,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await closeKysely(this.db);
  }
}

@Global()
@Module({
  providers: [AdminDatabaseService, TenantDatabaseManager],
  exports: [AdminDatabaseService, TenantDatabaseManager],
})
export class DatabaseModule {}
