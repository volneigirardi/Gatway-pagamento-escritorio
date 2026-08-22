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
