import type { Kysely } from "kysely";
import type { OutboxDatabase } from "./database.js";
import type { OutboxEvent } from "./types.js";

export type EventHandler = (event: OutboxEvent) => Promise<void>;

export interface OutboxRelay {
  poll(
    db: Kysely<OutboxDatabase>,
    batchSize: number,
    handler: EventHandler,
  ): Promise<number>;
}

export class KyselyOutboxRelay implements OutboxRelay {
  async poll(
    db: Kysely<OutboxDatabase>,
    batchSize: number,
    handler: EventHandler,
  ): Promise<number> {
    const rows = await db
      .selectFrom("outbox")
      .selectAll()
      .where("processed_at", "is", null)
      .orderBy("created_at", "asc")
      .limit(batchSize)
      .execute();

    for (const row of rows) {
      const event: OutboxEvent = {
        id: String(row["id"]),
        tenantId: String(row["tenant_id"]),
        aggregateType: String(row["aggregate_type"]),
        aggregateId: String(row["aggregate_id"]),
        type: String(row["type"]),
        payload: JSON.parse(String(row["payload"])) as Record<string, unknown>,
        metadata: JSON.parse(String(row["metadata"] ?? "{}")) as Record<
          string,
          unknown
        >,
        createdAt: String(row["created_at"]),
      };
      await handler(event);
      await db
        .updateTable("outbox")
        .set("processed_at", new Date().toISOString())
        .where("id", "=", String(row["id"]))
        .execute();
    }

    return rows.length;
  }
}
