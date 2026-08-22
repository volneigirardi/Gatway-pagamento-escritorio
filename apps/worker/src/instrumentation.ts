// Must be the first import in main.ts so instrumentations patch modules
// (http, pg) before they are required elsewhere.
import { initTelemetry } from "@saas/observability";

initTelemetry({
  serviceName: "worker",
  serviceVersion: process.env["npm_package_version"] ?? "0.0.0",
  environment: process.env["NODE_ENV"] ?? "development",
  otlpEndpoint: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  enabled: process.env["OTEL_ENABLED"] === "true",
});
