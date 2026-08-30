# Same-origin routing

## Public origin

The only public application origin is `https://app.blupo.com.br`.

| Path prefix  | Destination |
| ------------ | ----------- |
| `/`          | Web SPA     |
| `/api`       | API         |
| `/socket.io` | Realtime    |

Do not create public `api.` or `realtime.` subdomains. Browser clients use relative URLs so cookies, CSRF protections, and WebSocket policy remain on the same origin.

## Development

Run API on port 3000, realtime on port 3002, and Vite on port 3004. Vite proxies `/api` and `/socket.io`; open only `http://localhost:3004` in the browser.

`CORS_ORIGINS` must contain the exact browser origin. For local development this is `http://localhost:3004`; for production it is `https://app.blupo.com.br`.

## Docker Swarm

`infra/docker/docker-compose.prod.yml` configures three Traefik routers on the same host. API and realtime path routers have higher priority than the web fallback. The web image listens as non-root on port 8080.

Before deployment:

1. Create the external overlay network `blupo-edge` on the Swarm managers.
2. Install the TLS, database, Redis, JWT, cookie, MFA, and CORS secrets out of band.
3. Ensure the CORS secret value is exactly `https://app.blupo.com.br`.
4. Configure the ACME operator email and durable certificate storage.
5. Render the stack configuration and review every router rule.
6. Verify `/api/v1/health/ready`, `/socket.io`, and `/` through the public origin.

## Kubernetes

`infra/kubernetes/base/ingress.yaml` routes the same three prefixes through ingress-nginx. Provision `app-blupo-tls` using the cluster's approved certificate operator before applying the ingress.

The base network policies assume the ingress controller runs in the `ingress-nginx` namespace. Change the namespace selector only when the real cluster layout differs and review that change before deployment.

## Validation

- Authentication sets the refresh cookie on `/` with `Secure`, `HttpOnly`, and `SameSite=Strict` in production.
- Browser requests never target a second application origin.
- API requests include the CSRF header only for refresh/logout operations.
- WebSocket upgrade succeeds at `/socket.io` over `wss`.
- Tenant and platform users are routed by signed realm claims, not by hostname.
