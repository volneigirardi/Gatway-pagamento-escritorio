# ADR-007: Cache and cookie policy

## Status

Accepted

## Context

Aplicação web/mobile lida com dados multi-tenant e autenticação.

## Decision

- Assets com hash: cache longo, immutable.
- HTML: no-cache.
- Dados autenticados: private/no-store por padrão; cacheável apenas por opt-in.
- Cookies de auth: Secure, HttpOnly, SameSite, Path restrito, prefixo __Host- quando possível.
- Tokens: refresh em cookie seguro ou secure store mobile; access token em memória.

## Consequences

- Pro: reduz risco de vazamento e cache cross-tenant.
- Con: implementação exige middleware/atentores em cada app.
