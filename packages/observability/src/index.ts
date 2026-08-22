import { AsyncLocalStorage } from "node:async_hooks";
import pino, { type Logger, type Level } from "pino";

export type { Logger, Level };
export { initTelemetry, shutdownTelemetry } from "./telemetry.js";
export type { TelemetryConfig } from "./telemetry.js";

export interface RequestContext {
  requestId: string;
  correlationId: string;
  tenantId?: string;
  userId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function createLogger(level: string = "info"): Logger {
  return pino({
    level: level as Level,
    base: null,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    redact: {
      paths: [
        "*.password",
        "*.token",
        "*.secret",
        "*.apiKey",
        "*.authorization",
        "*.refreshToken",
        "*.creditCard",
      ],
      censor: "[REDACTED]",
    },
  });
}

export function getChildLogger(baseLogger: Logger): Logger {
  const context = getRequestContext();
  if (!context) return baseLogger;
  return baseLogger.child({
    requestId: context.requestId,
    correlationId: context.correlationId,
    tenantId: context.tenantId,
    userId: context.userId,
  });
}
