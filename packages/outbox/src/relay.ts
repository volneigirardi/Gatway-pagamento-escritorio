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

function recordValue(value: unknown): Record<string, unknown> {
  const parsed =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Outbox JSON value must be an object");
  }
  return parsed as Record<string, unknown>;
}

export class KyselyOutboxRelay implements OutboxRelay {
  async poll(
    db: Kysely<OutboxDatabase>,
    batchSize: number,
    handler: EventHandler,
  ): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new RangeError("batchSize must be a positive integer");
    }

    let processed = 0;
    while (processed < batchSize) {
      const handled = await db.transaction().execute(async (transaction) => {
        const row = await transaction
          .selectFrom("outbox")
          .selectAll()
          .where("processed_at", "is", null)
          .orderBy("created_at", "asc")
          .forUpdate()
          .skipLocked()
          .limit(1)
          .executeTakeFirst();
        if (!row) return false;

        const event: OutboxEvent = {
          id: String(row.id),
          tenantId: String(row.tenant_id),
          aggregateType: String(row.aggregate_type),
          aggregateId: String(row.aggregate_id),
          type: String(row.type),
          payload: recordValue(row.payload),
          metadata: recordValue(row.metadata ?? {}),
          createdAt: String(row.created_at),
        };
        await handler(event);
        await transaction
          .updateTable("outbox")
          .set("processed_at", new Date().toISOString())
          .where("id", "=", String(row.id))
          .where("processed_at", "is", null)
          .executeTakeFirstOrThrow();
        return true;
      });
      if (!handled) break;
      processed += 1;
    }

    return processed;
  }
}
