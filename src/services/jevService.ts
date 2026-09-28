import type { ComponentRerankConfig } from "@/types/aiProvider";
import { isRecord } from "@/utils/typeGuards";

type JevConnection = ComponentRerankConfig & { signal?: AbortSignal };

export interface JevSystemOneResponse extends Record<string, unknown> {
  answers: Record<string, unknown>;
}

export interface JevModel extends Record<string, unknown> {
  name: string;
  description?: string;
}

export class JevRequestError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(response: Response) {
    const descriptions: Record<number, string> = {
      401: "authentication failed",
      403: "access denied",
      429: "rate limit reached",
      504: "request timed out",
    };
    const retryAfter = response.headers.get("retry-after");
    let retryMessage = "";
    if (retryAfter && /^\d+$/.test(retryAfter)) {
      retryMessage = ` Retry after ${retryAfter} seconds.`;
    } else if (retryAfter && Number.isFinite(Date.parse(retryAfter))) {
      retryMessage = ` Retry after ${new Date(retryAfter).toUTCString()}.`;
    }
    super(
      `Jev ${descriptions[response.status] ?? "request failed"} (HTTP ${response.status}).${retryMessage}`,
    );
    this.name = "JevRequestError";
    this.status = response.status;
    this.retryAfter = retryAfter;
  }
}

async function requestJev(
  endpoint: "systemone" | "models",
  options: JevConnection,
  body?: unknown,
): Promise<unknown> {
  const base = options.apiBase.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Configure the AI provider in Settings before searching.");
  }
  const key = options.apiKey.trim();
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(`${base}/${endpoint}`, {
    method: endpoint === "models" ? "GET" : "POST",
    signal: options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
    credentials: options.credentials ?? "omit",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new JevRequestError(response);
  try {
    return await response.json();
  } catch (error) {
    // Preserve cancellation during a response body read.
    if (options.signal?.aborted) options.signal.throwIfAborted();
    if (timeout.aborted) timeout.throwIfAborted();
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Jev returned a non-JSON response.");
  }
}

export async function requestJevSystemOne(
  payload: { model: string; state: unknown; questions: unknown },
  options: JevConnection,
): Promise<JevSystemOneResponse> {
  if (!payload.model.trim() || payload.model.includes(":")) {
    throw new Error("Enter a bare Jev model name, such as jev-1.13.0.");
  }
  const response = await requestJev("systemone", options, payload);
  if (!isRecord(response) || !isRecord(response.answers)) {
    throw new Error("Jev returned an invalid ranking response.");
  }
  return { ...response, answers: response.answers };
}

export async function fetchJevModels(
  options: JevConnection,
): Promise<JevModel[]> {
  const response = await requestJev("models", options);
  if (
    !isRecord(response) ||
    !Array.isArray(response.models) ||
    !response.models.every(
      (model): model is JevModel =>
        isRecord(model) &&
        typeof model.name === "string" &&
        model.name.trim().length > 0 &&
        !model.name.includes(":") &&
        (model.description === undefined ||
          typeof model.description === "string"),
    )
  ) {
    throw new Error("Jev returned an invalid model catalog.");
  }
  return response.models;
}
