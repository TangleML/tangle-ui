import { array, object, optional, string } from "zod/mini";

import type { CookieProvider } from "./auth/oktaSsoAuth.ts";

const sessionSchema = object({ id: string(), name: string() });
const sessionEnvelope = object({ session: sessionSchema });
const bundleSchema = object({
  id: string(),
  name: string(),
  version: string(),
  description: optional(string()),
});
const bundlesEnvelope = object({ bundles: array(bundleSchema) });

export interface TangentSession {
  id: string;
  name: string;
}

export interface TangentBundle {
  id: string;
  name: string;
  version: string;
  description?: string;
}

/**
 * The Shell's session REST API. Chat itself runs in the session chat panel,
 * whose embedded Tangent UI owns the chat socket.
 */
export class TangentClient {
  private readonly baseUrl: string;
  private readonly cookieProvider: CookieProvider | undefined;

  constructor(baseUrl: string, cookieProvider?: CookieProvider) {
    this.baseUrl = baseUrl;
    this.cookieProvider = cookieProvider;
  }

  async listBundles(): Promise<TangentBundle[]> {
    const body = bundlesEnvelope.parse(
      await this.requestJson("GET", "/api/agent-bundles"),
    );
    return body.bundles;
  }

  async createSession(
    bundleId: string,
    name?: string,
    tags?: string[],
  ): Promise<TangentSession> {
    const body = sessionEnvelope.parse(
      await this.requestJson("POST", "/api/sessions", {
        bundleId,
        ...(name ? { name } : {}),
        ...(tags ? { tags } : {}),
      }),
    );
    return body.session;
  }

  async updateSessionTags(sessionId: string, tags: string[]): Promise<void> {
    await this.requestJson(
      "PATCH",
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { tags },
    );
  }

  async getSession(sessionId: string): Promise<TangentSession> {
    const body = sessionEnvelope.parse(
      await this.requestJson(
        "GET",
        `/api/sessions/${encodeURIComponent(sessionId)}`,
      ),
    );
    return body.session;
  }

  private async requestJson(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    let response = await this.send(method, path, body, await this.cookie());
    if (response.status === 401 && this.cookieProvider) {
      const refreshed = await this.cookieProvider({ forceRefresh: true });
      response = await this.send(method, path, body, refreshed);
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
    }
    return response.json();
  }

  private cookie(): Promise<string | undefined> {
    return this.cookieProvider?.() ?? Promise.resolve(undefined);
  }

  private send(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body: unknown,
    cookie: string | undefined,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
