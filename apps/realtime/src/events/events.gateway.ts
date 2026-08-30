import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  Ack,
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
import { JoseJwtVerifier } from "@saas/auth";
import { z } from "zod";

const chatMessageSchema = z.object({
  eventId: z.uuid(),
  content: z.string().min(1).max(1000),
});

interface SocketAuth {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
}

interface SocketData {
  auth?: SocketAuth;
}

interface AckResponse {
  ok: boolean;
  code?: string;
}

const BROADCAST_RATE_LIMIT = 20;
const BROADCAST_RATE_WINDOW_MS = 10_000;
const DEDUPE_TTL_MS = 5 * 60_000;
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = now - tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", key, "-inf", window_start)
if redis.call("ZCARD", key) >= limit then
  redis.call("PEXPIRE", key, ARGV[2])
  return 0
end
redis.call("ZADD", key, now, ARGV[4])
redis.call("PEXPIRE", key, ARGV[2])
return 1
`;

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
  private readonly jwtVerifier: JoseJwtVerifier;

  constructor() {
    this.logger = createLogger(
      (process.env["LOG_LEVEL"] as Level | undefined) ?? "info",
    ).child({ gateway: "events" });
    const publicKey = process.env["JWT_PUBLIC_KEY"];
    const issuer = process.env["JWT_ISSUER"];
    const platformAudience = process.env["JWT_PLATFORM_AUDIENCE"];
    const tenantAudience = process.env["JWT_TENANT_AUDIENCE"];
    if (!publicKey || !issuer || !platformAudience || !tenantAudience) {
      throw new Error(
        "JWT_PUBLIC_KEY, JWT_ISSUER, JWT_PLATFORM_AUDIENCE, and JWT_TENANT_AUDIENCE are required",
      );
    }
    const keyId = process.env["JWT_KEY_ID"];
    this.jwtVerifier = new JoseJwtVerifier(publicKey, {
      issuer,
      platformAudience,
      tenantAudience,
      ...(keyId ? { keyId } : {}),
    });
  }

  afterInit(server: Server): void {
    const redisUrl = process.env["REDIS_URL"];
    if (!redisUrl) {
      throw new Error("REDIS_URL is required");
    }
    this.redisPubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
    this.redisSubClient = this.redisPubClient.duplicate();

    this.redisPubClient.on("error", (err) => {
      this.logger.error({ err }, "Redis pub client error");
    });
    this.redisSubClient.on("error", (err) => {
      this.logger.error({ err }, "Redis sub client error");
    });

    // NestJS binds `@WebSocketServer()` to the Namespace instance (not the
    // top-level Server) when the gateway declares an explicit `namespace`
    // option, even for the default "/" namespace. Namespace has no
    // `.adapter()` method — only Server does — but exposes `.server` back
    // to the top-level Server. Verified via a real runtime crash
    // (`TypeError: server.adapter is not a function`) during the Fase 5
    // foundation audit; the unit test never caught this because it mocked
    // `server` manually instead of exercising a real Socket.IO instance.
    const ioServer: Server =
      "adapter" in server && typeof server.adapter === "function"
        ? server
        : (server as unknown as { server: Server }).server;
    void ioServer.adapter(
      createAdapter(this.redisPubClient, this.redisSubClient),
    );

    // Authenticate in a connection middleware, not in `handleConnection`.
    // `handleConnection` runs *after* the client is already connected and
    // able to send messages — since it is async (awaits JWT verification),
    // a client that emits a message immediately on `connect` can race
    // ahead of it and be spuriously rejected as unauthorized even with a
    // valid token. `io.use()` middleware blocks the connection handshake
    // itself until it calls `next()`, guaranteeing `socket.data.auth` is
    // set before any message handler can run. Found via a real two-node
    // integration test during the Fase 5 foundation audit (a client
    // joining immediately after connecting was rejected as unauthorized).
    ioServer.use((socket, next) => {
      void this.verifyHandshake(socket)
        .then((auth) => {
          if (!auth) {
            this.logger.warn(
              { socketId: socket.id },
              "Unauthenticated connection rejected",
            );
            next(new Error("unauthorized"));
            return;
          }
          (socket.data as SocketData).auth = auth;
          next();
        })
        .catch((error: unknown) => {
          this.logger.error({ error, socketId: socket.id }, "Handshake failed");
          next(new Error("unauthorized"));
        });
    });

    this.logger.info("Realtime gateway initialized with Redis adapter");
  }

  handleConnection(client: Socket): void {
    const auth = (client.data as Partial<SocketData>).auth;
    this.logger.info(
      { socketId: client.id, tenantId: auth?.tenantId, userId: auth?.userId },
      "Client connected",
    );
  }

  handleDisconnect(client: Socket): void {
    const auth = (client.data as Partial<SocketData>).auth;
    this.logger.info(
      { socketId: client.id, tenantId: auth?.tenantId },
      "Client disconnected",
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.server.local.disconnectSockets(true);
    await Promise.all([
      this.redisPubClient?.quit() ?? Promise.resolve("OK"),
      this.redisSubClient?.quit() ?? Promise.resolve("OK"),
    ]);
    this.logger.info("Realtime gateway shut down");
  }

  @SubscribeMessage("v1.events.join")
  async handleJoin(
    @MessageBody() _data: unknown,
    @ConnectedSocket() client: Socket,
    @Ack() ack?: (response: AckResponse) => void,
  ): Promise<void> {
    const auth = (client.data as SocketData).auth;
    const tenantId = auth?.tenantId;
    if (!tenantId) {
      client.emit("v1.events.error", { code: "unauthorized" });
      ack?.({ ok: false, code: "unauthorized" });
      return;
    }
    try {
      await client.join(`tenant:${tenantId}`);
      client.emit("v1.events.joined", { tenantId });
      ack?.({ ok: true });
    } catch (error) {
      this.logger.error(
        { error, socketId: client.id, tenantId },
        "Tenant room join failed",
      );
      client.emit("v1.events.error", { code: "service_unavailable" });
      ack?.({ ok: false, code: "service_unavailable" });
    }
  }

  @SubscribeMessage("v1.events.broadcast")
  async handleBroadcast(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
    @Ack() ack?: (response: AckResponse) => void,
  ): Promise<void> {
    const auth = (client.data as SocketData).auth;
    if (!auth) {
      client.emit("v1.events.error", { code: "unauthorized" });
      ack?.({ ok: false, code: "unauthorized" });
      return;
    }
    if (!auth.permissions.includes("realtime:broadcast")) {
      client.emit("v1.events.error", { code: "forbidden" });
      ack?.({ ok: false, code: "forbidden" });
      return;
    }

    const parsed = chatMessageSchema.safeParse(data);
    if (!parsed.success) {
      client.emit("v1.events.error", { code: "invalid_payload" });
      ack?.({ ok: false, code: "invalid_payload" });
      return;
    }

    try {
      if (!(await this.allowBroadcast(auth, parsed.data.eventId))) {
        client.emit("v1.events.error", { code: "rate_limited" });
        ack?.({ ok: false, code: "rate_limited" });
        return;
      }
      if (!(await this.rememberEvent(auth.tenantId, parsed.data.eventId))) {
        ack?.({ ok: true });
        return;
      }

      this.server.to(`tenant:${auth.tenantId}`).emit("v1.events.message", {
        eventId: parsed.data.eventId,
        tenantId: auth.tenantId,
        content: parsed.data.content,
        timestamp: new Date().toISOString(),
      });
      ack?.({ ok: true });
    } catch (error) {
      this.logger.error(
        { error, socketId: client.id, tenantId: auth.tenantId },
        "Realtime broadcast failed",
      );
      client.emit("v1.events.error", { code: "service_unavailable" });
      ack?.({ ok: false, code: "service_unavailable" });
    }
  }

  private async allowBroadcast(
    auth: SocketAuth,
    eventId: string,
  ): Promise<boolean> {
    const redis = this.redisPubClient;
    if (!redis) throw new Error("Redis client is unavailable");
    const result = await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      `realtime:rate:${auth.tenantId}:${auth.userId}`,
      String(Date.now()),
      String(BROADCAST_RATE_WINDOW_MS),
      String(BROADCAST_RATE_LIMIT),
      eventId,
    );
    return Number(result) === 1;
  }

  private async rememberEvent(
    tenantId: string,
    eventId: string,
  ): Promise<boolean> {
    const redis = this.redisPubClient;
    if (!redis) throw new Error("Redis client is unavailable");
    const result = await redis.set(
      `realtime:dedupe:${tenantId}:${eventId}`,
      "1",
      "PX",
      DEDUPE_TTL_MS,
      "NX",
    );
    return result === "OK";
  }

  private async verifyHandshake(client: Socket): Promise<SocketAuth | null> {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const token = auth?.token;
    if (!token) return null;
    const user = await this.jwtVerifier.verify(token);
    if (user?.realm !== "tenant") return null;
    return {
      tenantId: user.tenantId,
      userId: user.userId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
