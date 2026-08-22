# Load Testing

## Tooling

- HTTP: k6 or Artillery.
- Socket.IO: custom k6 extension or Node client load generator.
- Database: pgbench + custom workload.

## Scenarios

### Smoke

- 1 user, all critical endpoints.
- Verify correctness.

### Load

- Ramp to target RPS over 10 minutes.
- Hold for 30 minutes.
- Validate p95 latency and error rate.

### Spike

- Instant 5x traffic.
- Verify auto-scaling and error rate.

### Soak

- Target load for 4 hours.
- Verify memory leaks, queue growth, connection stability.

### Failover

- Kill Redis, PostgreSQL replica, or app pod.
- Verify graceful degradation and recovery.

## CI Integration

- Load tests run on staging after deploy.
- Compare results against baseline.
- Fail on regression > 20%.

## Reporting

Each test report includes:

- Date, version, environment.
- Hardware.
- Workload definition.
- Latency percentiles.
- Error rates.
- Resource utilization.
