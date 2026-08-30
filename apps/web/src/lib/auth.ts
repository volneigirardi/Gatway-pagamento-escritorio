import {
  authSessionSchema,
  authStepSchema,
  loginRequestSchema,
  mfaConfirmationSchema,
  mfaRecoveryRequestSchema,
  mfaSetupSchema,
  mfaVerifyRequestSchema,
  passwordChangeRequestSchema,
  type AuthSession,
  type AuthStep,
} from "@saas/contracts";
import {
  ApiError,
  rawApiEnvelope,
  rawApiRequest,
  type ApiEnvelope,
} from "./http.js";

const csrfStorageKey = "blupo.csrf";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: AuthSession; expiresAt: number };

let state: AuthState = { status: "loading" };
let initialization: Promise<void> | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function csrfStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function setAnonymous(): void {
  csrfStorage()?.removeItem(csrfStorageKey);
  state = { status: "anonymous" };
  notify();
}

function setSession(session: AuthSession): void {
  csrfStorage()?.setItem(csrfStorageKey, session.csrfToken);
  state = {
    status: "authenticated",
    session,
    expiresAt: Date.now() + session.expiresInSeconds * 1000,
  };
  notify();
}

async function refresh(): Promise<AuthSession> {
  const csrfToken = csrfStorage()?.getItem(csrfStorageKey);
  if (!csrfToken) throw new ApiError(401, "Sessão indisponível.");
  refreshInFlight ??= rawApiRequest("/auth/refresh", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
  })
    .then((data) => authSessionSchema.parse(data))
    .then((session) => {
      setSession(session);
      return session;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function authStepRequest(
  path: string,
  payload: Record<string, unknown>,
): Promise<AuthStep> {
  const step = authStepSchema.parse(
    await rawApiRequest(path, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  if (step.status === "authenticated") setSession(step);
  return step;
}

async function authorizedEnvelope(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope> {
  let current = state;
  if (current.status !== "authenticated") {
    throw new ApiError(401, "Autenticação necessária.");
  }
  if (current.expiresAt - Date.now() < 30_000) {
    try {
      await refresh();
      current = state;
    } catch {
      setAnonymous();
      throw new ApiError(401, "Sua sessão expirou.");
    }
  }
  if (current.status !== "authenticated") {
    throw new ApiError(401, "Autenticação necessária.");
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${current.session.accessToken}`);
  try {
    return await rawApiEnvelope(path, { ...init, headers });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      const session = await refresh();
      headers.set("authorization", `Bearer ${session.accessToken}`);
      return await rawApiEnvelope(path, { ...init, headers });
    } catch {
      setAnonymous();
      throw new ApiError(401, "Sua sessão expirou.");
    }
  }
}

export const authClient = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): AuthState {
    return state;
  },

  initialize(): Promise<void> {
    initialization ??= (async () => {
      if (!csrfStorage()?.getItem(csrfStorageKey)) {
        setAnonymous();
        return;
      }
      try {
        await refresh();
      } catch {
        setAnonymous();
      }
    })();
    return initialization;
  },

  async login(email: string, password: string): Promise<AuthStep> {
    const input = loginRequestSchema.parse({ email, password });
    return authStepRequest("/auth/login", input);
  },

  async changePassword(
    challengeToken: string,
    newPassword: string,
  ): Promise<AuthStep> {
    const input = passwordChangeRequestSchema.parse({
      challengeToken,
      newPassword,
    });
    return authStepRequest("/auth/password/change", input);
  },

  async setupMfa(challengeToken: string): Promise<{
    challengeToken: string;
    uri: string;
    secret: string;
  }> {
    return mfaSetupSchema.parse(
      await rawApiRequest("/auth/mfa/setup", {
        method: "POST",
        body: JSON.stringify({ challengeToken }),
      }),
    );
  },

  async confirmMfa(challengeToken: string, code: string): Promise<string[]> {
    const input = mfaVerifyRequestSchema.parse({ challengeToken, code });
    const result = mfaConfirmationSchema.parse(
      await rawApiRequest("/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    setSession(result);
    return result.recoveryCodes;
  },

  async verifyMfa(challengeToken: string, code: string): Promise<AuthSession> {
    const input = mfaVerifyRequestSchema.parse({ challengeToken, code });
    const session = authSessionSchema.parse(
      await rawApiRequest("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    setSession(session);
    return session;
  },

  async verifyRecoveryCode(
    challengeToken: string,
    recoveryCode: string,
  ): Promise<AuthSession> {
    const input = mfaRecoveryRequestSchema.parse({
      challengeToken,
      recoveryCode: recoveryCode.toUpperCase(),
    });
    const session = authSessionSchema.parse(
      await rawApiRequest("/auth/mfa/recovery", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    setSession(session);
    return session;
  },

  async logout(): Promise<void> {
    const csrfToken = csrfStorage()?.getItem(csrfStorageKey);
    try {
      if (csrfToken) {
        await rawApiRequest("/auth/logout", {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
        });
      }
    } finally {
      setAnonymous();
    }
  },

  async request(path: string, init: RequestInit = {}): Promise<unknown> {
    return (await authorizedEnvelope(path, init)).data;
  },

  requestEnvelope(path: string, init: RequestInit = {}): Promise<ApiEnvelope> {
    return authorizedEnvelope(path, init);
  },
};

export type { AuthState };
