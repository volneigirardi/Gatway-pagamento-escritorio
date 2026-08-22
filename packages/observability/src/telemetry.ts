import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string | undefined;
  environment?: string | undefined;
  otlpEndpoint?: string | undefined;
  enabled?: boolean | undefined;
}

let sdk: NodeSDK | undefined;

/**
 * Initializes OpenTelemetry tracing and metrics for a Node.js service.
 * Must be called before importing any instrumented module (http, pg, fastify).
 * No-op when `enabled` is false or `otlpEndpoint` is not provided, so services
 * can run without a collector in local/dev environments.
 */
export function initTelemetry(config: TelemetryConfig): NodeSDK | undefined {
  if (config.enabled === false || !config.otlpEndpoint) {
    return undefined;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion ?? "0.0.0",
    "deployment.environment.name": config.environment ?? "development",
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${config.otlpEndpoint}/v1/traces`,
  });
  const metricExporter = new OTLPMetricExporter({
    url: `${config.otlpEndpoint}/v1/metrics`,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15000,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new PgInstrumentation({
        // Do not record raw SQL parameters to avoid leaking tenant data.
        enhancedDatabaseReporting: false,
      }),
    ],
  });

  sdk.start();

  const shutdown = (): void => {
    void sdk
      ?.shutdown()
      .catch(() => {
        // Best-effort shutdown; do not block process exit on telemetry flush errors.
      });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
