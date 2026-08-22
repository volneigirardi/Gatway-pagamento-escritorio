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

`X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, and the
CSP `frame-ancestors` directive are only enforced by browsers as real HTTP
response headers — a `<meta http-equiv>` tag is silently ignored for these
(confirmed via a Playwright console-error assertion in
`apps/web/e2e/smoke.spec.ts`, caught during Fase 4). They are set as
headers in `infra/docker/nginx.conf`; `apps/web/index.html` keeps only the
CSP directives and `Referrer-Policy` that are meaningfully enforced via
`<meta>`, as a fallback for contexts serving the static build without the
header layer (e.g. local `vite preview`).

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
