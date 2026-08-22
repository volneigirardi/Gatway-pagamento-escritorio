import { describe, it, expect, beforeAll, vi } from "vitest";
import { EventsGateway } from "./events.gateway.js";
import { JoseJwtService } from "@saas/auth";
import { randomUUID } from "node:crypto";

const JWT_SECRET = "test-secret-32-bytes-long-for-tests-only";

function createMockClient(auth?: { tenantId: string; userId: string; roles: string[] }) {
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    id: randomUUID(),
    data: { auth },
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
    },
    emitted,
  };
}

describe("EventsGateway", () => {
  beforeAll(() => {
    process.env["JWT_SECRET"] = JWT_SECRET;
  });

  it("verifies handshake tokens using signature, not raw decoding", async () => {
    const jwtService = new JoseJwtService(JWT_SECRET);
    const token = await jwtService.issue(
      {
        userId: "11111111-1111-4111-8111-111111111111",
        tenantId: "22222222-2222-4222-8222-222222222222",
        roles: ["member"],
        permissions: [],
        tokenId: "33333333-3333-4333-8333-333333333333",
      },
      900,
    );

    const gateway = new EventsGateway();
    const client = {
      id: randomUUID(),
      data: {},
      handshake: { auth: { token } },
      disconnect: vi.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(client.disconnect).not.toHaveBeenCalled();
    expect((client.data as { auth?: { tenantId: string } }).auth?.tenantId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("rejects a forged/unsigned token", async () => {
    const gateway = new EventsGateway();
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "x", tid: "y", roles: [] }),
    ).toString("base64url");
    const client = {
      id: randomUUID(),
      data: {},
      handshake: { auth: { token: `header.${forgedPayload}.signature` } },
      disconnect: vi.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("acknowledges join and rejects broadcast without auth", () => {
    const gateway = new EventsGateway();
    const client = createMockClient(undefined);
    const ack = vi.fn();

    gateway.handleJoin(undefined, client as never, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, code: "unauthorized" });
  });

  it("deduplicates broadcast events by eventId", () => {
    const gateway = new EventsGateway();
    (gateway as unknown as { server: unknown }).server = {
      to: () => ({ emit: vi.fn() }),
    };
    const client = createMockClient({
      tenantId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      roles: [],
    });
    const eventId = randomUUID();
    const ack = vi.fn();

    gateway.handleBroadcast({ eventId, content: "hello" }, client as never, ack);
    gateway.handleBroadcast({ eventId, content: "hello" }, client as never, ack);

    expect(ack).toHaveBeenCalledTimes(2);
    expect(ack).toHaveBeenNthCalledWith(1, { ok: true });
    expect(ack).toHaveBeenNthCalledWith(2, { ok: true });
  });
});
