import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { ServerResponse } from "node:http";
import type { FastifyRequest } from "fastify";
import { runWithRequestContext } from "@saas/observability";
import { randomUUID } from "node:crypto";

function validId(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  )
    ? value
    : undefined;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: ServerResponse, next: () => void): void {
    const requestId = validId(req.headers["x-request-id"]) ?? randomUUID();
    const correlationId = validId(req.headers["x-correlation-id"]) ?? requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);
    runWithRequestContext({ requestId, correlationId }, next);
  }
}
