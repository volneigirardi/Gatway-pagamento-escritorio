import {
  circuitBreaker,
  ConsecutiveBreaker,
  handleAll,
  retry,
  ExponentialBackoff,
  timeout,
  TimeoutStrategy,
  wrap,
} from "cockatiel";
import { assertPublicHttpUrl, type SsrfGuardOptions } from "./ssrf-guard.js";

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface SafeHttpClientOptions extends SsrfGuardOptions {
  /** Per-request timeout in milliseconds. Default 10s. */
  timeoutMs?: number;
  /** Max retry attempts for idempotent requests (or mutating requests with an Idempotency-Key header). Default 3. */
  maxRetries?: number;
  /** Open the circuit after this many consecutive failures. Default 5. */
  circuitBreakerThreshold?: number;
  /** How long the circuit stays open before a half-open probe. Default 30s. */
  circuitBreakerResetMs?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface SafeHttpClient {
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
}

/**
 * Wraps `fetch` with the defense-in-depth outbound-call policy required for
 * external integrations (see .devin/rules/external-integrations.md):
 * SSRF-safe URL validation, a bounded timeout, retry with jittered backoff
 * (only for safe/idempotent requests unless the caller marks the request
 * with an `Idempotency-Key` header), and a circuit breaker so a failing
 * downstream does not exhaust this process's resources.
 */
export function createSafeHttpClient(
  options: SafeHttpClientOptions = {},
): SafeHttpClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 3;

  const timeoutPolicy = timeout(timeoutMs, TimeoutStrategy.Aggressive);
  const retryPolicy = retry(handleAll, {
    maxAttempts: maxRetries,
    backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5_000 }),
  });
  const breakerPolicy = circuitBreaker(handleAll, {
    halfOpenAfter: options.circuitBreakerResetMs ?? 30_000,
    breaker: new ConsecutiveBreaker(options.circuitBreakerThreshold ?? 5),
  });

  const resilientPolicy = wrap(retryPolicy, timeoutPolicy, breakerPolicy);
  const nonRetryingPolicy = wrap(timeoutPolicy, breakerPolicy);

  return {
    async fetch(input, init) {
      const url = typeof input === "string" ? input : input.toString();
      await assertPublicHttpUrl(url, options);

      const method = (init?.method ?? "GET").toUpperCase();
      const isSafeToRetry =
        IDEMPOTENT_METHODS.has(method) ||
        (init?.headers &&
          new Headers(init.headers).has("idempotency-key"));

      const policy = isSafeToRetry ? resilientPolicy : nonRetryingPolicy;

      return policy.execute(({ signal }) =>
        fetchImpl(input, { ...init, signal }),
      );
    },
  };
}
