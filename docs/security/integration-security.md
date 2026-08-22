# Integration and Webhook Security

## Webhooks (Inbound)

- Preserve raw body for signature verification.
- Verify HMAC-SHA256 signature.
- Validate timestamp within replay window (e.g., 5 minutes).
- Store provider event ID; unique constraint prevents replay.
- Respond quickly (2xx), process asynchronously.
- Idempotency via event ID.
- Logs without secrets.

## External Outbound Calls

- Validate URLs against allowlist.
- Timeout on connect/read/response.
- Retry with exponential backoff + jitter only for safe/idempotent operations.
- Circuit breaker on failures.
- Validate response schema; do not trust external data.
- mTLS for sensitive integrations.
- Outbound egress policy restrict destinations.

## API Keys for Integrations

- Scoped per tenant.
- Hashed in database.
- Rotation and revocation support.
- Rate limits per integration/key.

## SSRF Protection

- Reject internal/private/reserved IP ranges.
- Use URL parser with strict scheme (https only).
- No redirects to internal endpoints.

## Implementation

`@saas/http-client` (`packages/http-client`) implements the outbound-call
requirements above:

- `assertPublicHttpUrl()` resolves the target hostname and rejects loopback,
  RFC1918 private ranges, link-local/cloud-metadata (`169.254.0.0/16`,
  including `169.254.169.254`), carrier-grade NAT, multicast, and IPv6
  loopback/unique-local/link-local equivalents. Non-`http(s)` schemes are
  rejected outright.
- `createSafeHttpClient()` wraps `fetch` with a per-request timeout, retry
  with exponential backoff (via `cockatiel`), and a circuit breaker.
  Retries only apply to `GET`/`HEAD`/`OPTIONS` or to mutating requests that
  carry an `Idempotency-Key` header, per the idempotency rules in
  `.devin/rules/queues-jobs.md` and `.devin/rules/external-integrations.md`.
- **Known residual risk**: the SSRF check resolves DNS once before the
  request; a DNS-rebinding attacker could change the record between the
  check and the actual connection. Acceptable for the current foundation
  phase (no external integrations implemented yet) but should be revisited
  (e.g. pinning the resolved IP via a custom `dns.lookup` on the request)
  before wiring a real webhook/integration module.
