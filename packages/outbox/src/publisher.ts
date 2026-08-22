import type { Kysely } from "kysely";
import { randomUUID } from "node:crypto";
import type { OutboxDatabase } from "./database.js";
import type { OutboxEvent } from "./types.js";

export interface OutboxPublisher {
  publish(
    db: Kysely<OutboxDatabase>,
    event: Omit<OutboxEvent, "id" | "createdAt">,
  ): Promise<void>;
}

export class KyselyOutboxPublisher implements OutboxPublisher {
  async publish(
    db: Kysely<OutboxDatabase>,
    event: Omit<OutboxEvent, "id" | "createdAt">,
  ): Promise<void> {
    await db
      .insertInto("outbox")
      .values({
        id: randomUUID(),
        tenant_id: event.tenantId,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        type: event.type,
        payload: JSON.stringify(event.payload),
        metadata: JSON.stringify(event.metadata),
        created_at: new Date().toISOString(),
        processed_at: null,
      })
      .execute();
  }
}
