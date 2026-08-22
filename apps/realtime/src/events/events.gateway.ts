import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from "@nestjs/websockets";
import type {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { createLogger, type Logger, type Level } from "@saas/observability";
import { JoseJwtService } from "@saas/auth";
import { z } from "zod";

const chatMessageSchema = z.object({
  eventId: z.uuid(),
  content: z.string().min(1).max(1000),
});

interface SocketAuth {
  tenantId: string;
  userId: string;
  roles: string[];
}

interface SocketData {
  auth?: SocketAuth;
}

interface AckResponse {
  ok: boolean;
  code?: string;
}

const BROADCAST_RATE_LIMIT = 20; // events per window, per socket
const BROADCAST_RATE_WINDOW_MS = 10_000;
const DEDUPE_CACHE_SIZE = 500;

class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter(
      (t) => now - t < windowMs,
    );
    if (timestamps.length >= limit) {
      this.hits.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}

/** Bounded set that evicts the oldest entry once it exceeds `maxSize`. */
class BoundedDedupeSet {
  private readonly seen = new Set<string>();

  constructor(private readonly maxSize: number) {}

  hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  remember(id: string): void {
    if (this.seen.size >= this.maxSize) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    this.seen.add(id);
  }
}

@WebSocketGateway({
  namespace: "/",
  cors: {
    origin: (process.env["CORS_ORIGINS"] ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
  transports: ["websocket"],
  maxHttpBufferSize: Number(
    process.env["WS_MAX_HTTP_BUFFER_SIZE"] ?? 1_000_000,
  ),
  pingTimeout: Number(process.env["WS_PING_TIMEOUT_MS"] ?? 20_000),
  pingInterval: Number(process.env["WS_PING_INTERVAL_MS"] ?? 5_000),
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger: Logger;
  private redisPubClient?: Redis;
  private redisSubClient?: Redis;
  private readonly jwtService: JoseJwtService;
  private readonly rateLimiter = new SlidingWindowLimiter();
  private readonly dedupeCache = new BoundedDedupeSet(DEDUPE_CACHE_SIZE);

  constructor() {
    this.logger = createLogger(
      (process.env["LOG_LEVEL"] as Level | undefined) ?? "info",
    ).child({ gateway: "events" });
    const secret = process.env["JWT_SECRET"];
    if (!secret) {
      throw new Error("JWT_SECRET is required");
    }
    this.jwtService = new JoseJwtService(secret);
  }

  afterInit(server: Server): void {
    const redisUrl = process.env["REDIS_URL"];
    if (!redisUrl) {
      throw new Error("REDIS_URL is required");
    }
    this.redisPubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.redisSubClient = this.redisPubClient.duplicate();

    this.redisPubClient.on("error", (err) => {
      this.logger.error({ err }, "Redis pub client error");
    });
    this.redisSubClient.on("error", (err) => {
      this.logger.error({ err }, "Redis sub client error");
    });

    void server.adapter(
      createAdapter(this.redisPubClient, this.redisSubClient),
    );
    this.logger.info("Realtime gateway initialized with Redis adapter");
  }

  async handleConnection(client: Socket): Promise<void> {
    const auth = await this.verifyHandshake(client);
    if (!auth) {
      this.logger.warn(
        { socketId: client.id },
        "Unauthenticated connection rejected",
      );
      client.disconnect(true);
      return;
    }
    (client.data as SocketData).auth = auth;
    this.logger.info(
      { socketId: client.id, tenantId: auth.tenantId, userId: auth.userId },
      "Client connected",
    );
  }

  handleDisconnect(client: Socket): void {
    const auth = (client.data as Partial<SocketData>).auth;
    this.rateLimiter.clear(client.id);
    this.logger.info(
      { socketId: client.id, tenantId: auth?.tenantId },
      "Client disconnected",
    );
  }

  onApplicationShutdown(): void {
    this.server.local.disconnectSockets(true);
    void this.redisPubClient?.quit();
    void this.redisSubClient?.quit();
    this.logger.info("Realtime gateway shut down");
  }

  @SubscribeMessage("v1.events.join")
  handleJoin(
    _data: unknown,
    client: Socket,
    ack?: (response: AckResponse) => void,
  ): void {
    const auth = (client.data as SocketData).auth;
    const tenantId = auth?.tenantId;
    if (!tenantId) {
      client.emit("v1.events.error", { code: "unauthorized" });
      ack?.({ ok: false, code: "unauthorized" });
      return;
    }
    const room = `tenant:${tenantId}`;
    void client.join(room);
    client.emit("v1.events.joined", { tenantId });
    ack?.({ ok: true });
  }

  @SubscribeMessage("v1.events.broadcast")
  handleBroadcast(
    data: unknown,
    client: Socket,
    ack?: (response: AckResponse) => void,
  ): void {
    const auth = (client.data as SocketData).auth;
    const tenantId = auth?.tenantId;
    if (!tenantId) {
      client.emit("v1.events.error", { code: "unauthorized" });
      ack?.({ ok: false, code: "unauthorized" });
      return;
    }

    if (
      !this.rateLimiter.allow(
        client.id,
        BROADCAST_RATE_LIMIT,
        BROADCAST_RATE_WINDOW_MS,
      )
    ) {
      client.emit("v1.events.error", { code: "rate_limited" });
      ack?.({ ok: false, code: "rate_limited" });
      return;
    }

    const parsed = chatMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("v1.events.error", { code: "invalid_payload" });
      ack?.({ ok: false, code: "invalid_payload" });
      return;
    }

    // Server-side dedupe: ignore events already processed (e.g. client retry
    // after a missed ack), scoped globally since eventId is a UUID.
    if (this.dedupeCache.hasSeen(parsed.data.eventId)) {
      ack?.({ ok: true });
      return;
    }
    this.dedupeCache.remember(parsed.data.eventId);

    const room = `tenant:${tenantId}`;
    this.server.to(room).emit("v1.events.message", {
      eventId: parsed.data.eventId,
      tenantId,
      content: parsed.data.content,
      timestamp: new Date().toISOString(),
    });
    ack?.({ ok: true });
  }

  private async verifyHandshake(client: Socket): Promise<SocketAuth | null> {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const token = auth?.token;
    if (!token) return null;
    const user = await this.jwtService.verify(token);
    if (!user) return null;
    return { tenantId: user.tenantId, userId: user.userId, roles: user.roles };
  }
}
