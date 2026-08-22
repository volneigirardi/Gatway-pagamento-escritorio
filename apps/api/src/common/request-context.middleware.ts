import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { runWithRequestContext } from "@saas/observability";
import { randomUUID } from "node:crypto";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    const correlationId =
      (req.headers["x-correlation-id"] as string | undefined) ?? requestId;
    void res.header("x-request-id", requestId);
    void res.header("x-correlation-id", correlationId);
    runWithRequestContext({ requestId, correlationId }, next);
  }
}
