import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { closeKysely, createKysely } from "@saas/database";
import type { Kysely } from "kysely";
import type { TenantDatabase } from "./tenant-database.js";

interface CachedTenantDatabase {
  database: Kysely<TenantDatabase>;
  lastUsed: number;
}

@Injectable()
export class TenantDatabaseManager implements OnApplicationShutdown {
  private readonly baseUrl: URL;
  private readonly cacheMaximum: number;
  private readonly poolMaximum: number;
  private readonly databases = new Map<string, CachedTenantDatabase>();

  constructor(config: ConfigService) {
    this.baseUrl = new URL(config.getOrThrow<string>("DATABASE_URL"));
    this.cacheMaximum = config.getOrThrow<number>("TENANT_POOL_CACHE_MAX");
    this.poolMaximum = config.getOrThrow<number>("TENANT_DATABASE_POOL_MAX");
  }

  async get(databaseName: string): Promise<Kysely<TenantDatabase>> {
    if (!/^tenant_[a-f0-9]{32}$/u.test(databaseName)) {
      throw new Error("Invalid tenant database name");
    }
    const cached = this.databases.get(databaseName);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.database;
    }
    if (this.databases.size >= this.cacheMaximum) await this.evictOldest();
    const url = new URL(this.baseUrl);
    url.pathname = `/${databaseName}`;
    const database = createKysely<TenantDatabase>({
      connectionString: url.toString(),
      poolMin: 0,
      poolMax: this.poolMaximum,
    });
    this.databases.set(databaseName, { database, lastUsed: Date.now() });
    return database;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...this.databases.values()].map(({ database }) => closeKysely(database)),
    );
    this.databases.clear();
  }

  private async evictOldest(): Promise<void> {
    let oldestName: string | undefined;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [name, entry] of this.databases) {
      if (entry.lastUsed < oldestTimestamp) {
        oldestName = name;
        oldestTimestamp = entry.lastUsed;
      }
    }
    if (!oldestName) return;
    const oldest = this.databases.get(oldestName);
    this.databases.delete(oldestName);
    if (oldest) await closeKysely(oldest.database);
  }
}
