# Web Security

## Transport

- TLS 1.3 only in production.
- HSTS with includeSubDomains and preload.
- Redirect HTTP to HTTPS at edge.

## Headers

| Header                    | Value                                        |
| ------------------------- | -------------------------------------------- |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| Content-Security-Policy   | strict policy, report-uri                    |
| X-Content-Type-Options    | nosniff                                      |
| X-Frame-Options           | DENY                                         |
| Referrer-Policy           | strict-origin-when-cross-origin              |
| Permissions-Policy        | restrict camera, microphone, geolocation     |

## Cookies

- Auth refresh cookie: `__Host-refresh` with Secure, HttpOnly, SameSite=Strict, Path=/.
- No sensitive data in client-side cookies except session identifiers.

## CSRF

- SameSite=Strict mitigates most CSRF.
- For defense in depth, use double-submit cookie or synchronizer token for state-changing operations.

## XSS

- CSP as primary defense.
- React escaping as secondary.
- Sanitize any user-generated HTML with DOMPurify.
- Never use `dangerouslySetInnerHTML` with untrusted input.

## Source Maps

- Do not deploy source maps publicly in production unless protected.
- Keep private source maps for error reporting service.

## Subresource Integrity

- Add SRI for any external scripts/styles.
- Prefer bundled dependencies over CDN.
