import { ConflictException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Transaction } from "kysely";
import type { AdminDatabase } from "./admin-database.js";
import { AdminDatabaseService } from "./database.module.js";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

@Injectable()
export class PlatformIdempotencyService {
  constructor(private readonly database: AdminDatabaseService) {}

  async execute<T>(input: {
    scope: string;
    key: string;
    actorIdentityId: string;
    request: unknown;
    callback: (transaction: Transaction<AdminDatabase>) => Promise<T>;
  }): Promise<IdempotentResult<T>> {
    const hash = requestHash(input.request);
    return this.database.db.transaction().execute(async (transaction) => {
      let claimed = await transaction
        .insertInto("platform_idempotency_keys")
        .values({
          actor_identity_id: input.actorIdentityId,
          scope: input.scope,
          key: input.key,
          request_hash: hash,
          status: "pending",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .onConflict((conflict) =>
          conflict.columns(["scope", "key"]).doNothing(),
        )
        .returning("id")
        .executeTakeFirst();

      if (!claimed) {
        const existing = await transaction
          .selectFrom("platform_idempotency_keys")
          .selectAll()
          .where("scope", "=", input.scope)
          .where("key", "=", input.key)
          .executeTakeFirstOrThrow();
        if (existing.expires_at < new Date()) {
          await transaction
            .deleteFrom("platform_idempotency_keys")
            .where("id", "=", existing.id)
            .execute();
          claimed = await transaction
            .insertInto("platform_idempotency_keys")
            .values({
              actor_identity_id: input.actorIdentityId,
              scope: input.scope,
              key: input.key,
              request_hash: hash,
              status: "pending",
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })
            .returning("id")
            .executeTakeFirstOrThrow();
        } else {
          if (existing.actor_identity_id !== input.actorIdentityId) {
            throw new ConflictException(
              "Idempotency key belongs to a different actor",
            );
          }
          if (existing.request_hash !== hash) {
            throw new ConflictException(
              "Idempotency key was already used for a different request",
            );
          }
          if (existing.status !== "completed" || existing.response === null) {
            throw new ConflictException("Idempotent request is still pending");
          }
          return { value: existing.response as T, replayed: true };
        }
      }

      const value = await input.callback(transaction);
      const updated = await transaction
        .updateTable("platform_idempotency_keys")
        .set({ status: "completed", response_status: 200, response: value })
        .where("id", "=", claimed.id)
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) !== 1) {
        throw new Error("Idempotency record was not completed");
      }
      return { value, replayed: false };
    });
  }
}

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9._:-]{16,255}$/u.test(value)) {
    throw new ConflictException(
      "A valid Idempotency-Key header with 16-255 characters is required",
    );
  }
  return value;
}
