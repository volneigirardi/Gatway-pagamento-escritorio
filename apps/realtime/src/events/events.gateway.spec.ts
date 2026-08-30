import { describe, it, expect, beforeAll, vi } from "vitest";
import { EventsGateway } from "./events.gateway.js";
import { JoseJwtIssuer } from "@saas/auth";
import { generateKeyPairSync, randomUUID } from "node:crypto";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
vi.mock("ioredis", () => {
  class Redis {
    private readonly values = new Set<string>();

    duplicate(): Redis {
      return new Redis();
    }
    on(): this {
      return this;
    }
    eval(): Promise<number> {
      return Promise.resolve(1);
    }
    set(key: string): Promise<"OK" | null> {
      if (this.values.has(key)) return Promise.resolve(null);
      this.values.add(key);
      return Promise.resolve("OK");
    }
    quit(): Promise<string> {
      return Promise.resolve("OK");
    }
  }
  return { Redis };
});

const jwtConfig = {
  issuer: "https://app.blupo.com.br",
  platformAudience: "blupo-platform",
  tenantAudience: "blupo-tenant",
  keyId: "test-key-1",
};

function createMockClient(auth?: {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
}) {
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    id: randomUUID(),
    data: { auth },
    join: vi.fn(() => Promise.resolve()),
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
    },
    emitted,
  };
}

/**
 * Authentication now happens in an `io.use()` middleware registered inside
 * `afterInit` (not in `handleConnection`), so any message a client sends
 * immediately after connecting is guaranteed to see `socket.data.auth`
 * already set — see events.gateway.ts for the race-condition rationale.
 * This helper builds a fake Socket.IO server that captures the registered
 * middleware so tests can invoke it directly, the same way the real
 * server would before emitting `connection`.
 */
function createGatewayWithCapturedMiddleware(): {
  gateway: EventsGateway;
  runMiddleware: (
    socket: unknown,
  ) => Promise<{ called: boolean; error: Error | undefined }>;
} {
  const gateway = new EventsGateway();
  let middleware:
    ((socket: unknown, next: (err?: Error) => void) => void) | undefined;
  const fakeServer = {
    adapter: vi.fn(),
    use: (fn: (socket: unknown, next: (err?: Error) => void) => void) => {
      middleware = fn;
    },
  };
  gateway.afterInit(fakeServer as never);

  return {
    gateway,
    runMiddleware: (socket) =>
      new Promise((resolve) => {
        middleware?.(socket, (err) => resolve({ called: true, error: err }));
      }),
  };
}

describe("EventsGateway", () => {
  beforeAll(() => {
    process.env["JWT_PUBLIC_KEY"] = keys.publicKey;
    process.env["JWT_ISSUER"] = jwtConfig.issuer;
    process.env["JWT_PLATFORM_AUDIENCE"] = jwtConfig.platformAudience;
    process.env["JWT_TENANT_AUDIENCE"] = jwtConfig.tenantAudience;
    process.env["JWT_KEY_ID"] = jwtConfig.keyId;
    process.env["REDIS_URL"] = "redis://localhost:6379";
  });

  it("verifies handshake tokens using signature, not raw decoding", async () => {
    const jwtIssuer = new JoseJwtIssuer(keys.privateKey, jwtConfig);
    const token = await jwtIssuer.issue(
      {
        realm: "tenant",
        userId: "11111111-1111-4111-8111-111111111111",
        tenantId: "22222222-2222-4222-8222-222222222222",
        roles: ["member"],
        permissions: [],
        tokenId: "33333333-3333-4333-8333-333333333333",
      },
      900,
    );

    const { runMiddleware } = createGatewayWithCapturedMiddleware();
    const socket = {
      id: randomUUID(),
      data: {},
      handshake: { auth: { token } },
    };

    const result = await runMiddleware(socket);

    expect(result.error).toBeUndefined();
    expect(
      (socket.data as { auth?: { tenantId: string } }).auth?.tenantId,
    ).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("rejects a forged/unsigned token before the connection completes", async () => {
    const { runMiddleware } = createGatewayWithCapturedMiddleware();
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "x", tid: "y", roles: [] }),
    ).toString("base64url");
    const socket = {
      id: randomUUID(),
      data: {},
      handshake: { auth: { token: `header.${forgedPayload}.signature` } },
    };

    const result = await runMiddleware(socket);

    expect(result.error).toBeInstanceOf(Error);
  });

  it("rejects platform-realm tokens from tenant realtime rooms", async () => {
    const jwtIssuer = new JoseJwtIssuer(keys.privateKey, jwtConfig);
    const token = await jwtIssuer.issue(
      {
        realm: "platform",
        userId: "11111111-1111-4111-8111-111111111111",
        roles: ["platform_owner"],
        permissions: ["platform:dashboard:read"],
        tokenId: "33333333-3333-4333-8333-333333333333",
      },
      900,
    );
    const { runMiddleware } = createGatewayWithCapturedMiddleware();
    const result = await runMiddleware({
      id: randomUUID(),
      data: {},
      handshake: { auth: { token } },
    });

    expect(result.error).toBeInstanceOf(Error);
  });

  it("rejects a join without authenticated tenant context", async () => {
    const gateway = new EventsGateway();
    const client = createMockClient(undefined);
    const ack = vi.fn();

    await gateway.handleJoin(undefined, client as never, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, code: "unauthorized" });
  });

  it("awaits tenant-room membership before acknowledging a join", async () => {
    const gateway = new EventsGateway();
    const client = createMockClient({
      tenantId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      roles: [],
      permissions: [],
    });
    const ack = vi.fn();

    await gateway.handleJoin(undefined, client as never, ack);

    expect(client.join).toHaveBeenCalledWith(
      "tenant:22222222-2222-4222-8222-222222222222",
    );
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it("deduplicates broadcast events by tenant and eventId", async () => {
    const { gateway } = createGatewayWithCapturedMiddleware();
    const emit = vi.fn();
    (gateway as unknown as { server: unknown }).server = {
      to: () => ({ emit }),
    };
    const client = createMockClient({
      tenantId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      roles: [],
      permissions: ["realtime:broadcast"],
    });
    const eventId = randomUUID();
    const ack = vi.fn();

    await gateway.handleBroadcast(
      { eventId, content: "hello" },
      client as never,
      ack,
    );
    await gateway.handleBroadcast(
      { eventId, content: "hello" },
      client as never,
      ack,
    );

    expect(emit).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(ack).toHaveBeenNthCalledWith(1, { ok: true });
    expect(ack).toHaveBeenNthCalledWith(2, { ok: true });
  });
});
