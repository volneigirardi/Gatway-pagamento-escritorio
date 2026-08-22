# Observability

Grafana dashboards, Prometheus scrape configs, OpenTelemetry collector config and alerting rules.

## Local stack

`api`, `realtime`, `worker`, and `scheduler` export traces and metrics via
OTLP/HTTP when `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` is set
(see `.env.example` and `packages/observability/src/telemetry.ts`).

Bring up an optional local collector + Prometheus + Grafana stack:

```bash
docker compose \
  -f infra/docker/docker-compose.dev.yml \
  -f infra/docker/docker-compose.observability.yml \
  up
```

- Collector OTLP endpoints: `http://localhost:4318` (HTTP), `localhost:4317` (gRPC)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3005 (admin / `GRAFANA_ADMIN_PASSWORD`)

The collector config (`otel-collector-config.yaml`) redacts `authorization`
and `cookie` attributes defensively before export, and currently logs traces
via the `debug` exporter. Wire a real tracing backend (Tempo, Jaeger, or a
vendor OTLP endpoint) before relying on this for production troubleshooting.

## Status

This stack is validated for local development wiring only (compose file
syntax and service definitions). It has not been exercised against a live
collector in this environment because Docker was not available during this
session — treat metrics/traces as unverified until run once locally.
