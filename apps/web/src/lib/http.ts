const apiPrefix = "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiEnvelope {
  data: unknown;
  error?: unknown;
  message?: unknown;
  detail?: unknown;
  title?: unknown;
  meta?: unknown;
}

function errorMessage(body: ApiEnvelope | null): string {
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.detail === "string") return body.detail;
  if (typeof body?.title === "string") return body.title;
  if (
    typeof body?.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return "A solicitação não pôde ser concluída.";
}

export async function rawApiEnvelope(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("API path must be relative");
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${apiPrefix}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 204) return { data: undefined };
  let body: ApiEnvelope | null = null;
  try {
    body = (await response.json()) as ApiEnvelope;
  } catch {
    if (!response.ok) throw new ApiError(response.status, errorMessage(null));
  }
  if (!response.ok) throw new ApiError(response.status, errorMessage(body));
  if (!body || !("data" in body)) {
    throw new ApiError(response.status, "Resposta inválida do servidor.");
  }
  return body;
}

export async function rawApiRequest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  return (await rawApiEnvelope(path, init)).data;
}
