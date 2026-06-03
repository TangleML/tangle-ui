import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import OpenAI from "openai";

import type { AiProviderConfig } from "@/types/aiProvider";
import { BASE_URL } from "@/utils/constants";

const AI_ASSISTANT_EMBEDDING_MODEL = "text-embedding-3-small";

export function getAgentModelConfig(
  config: AiProviderConfig,
): { model: string } | {} {
  const model = config.model.trim();
  return model ? { model } : {};
}

export function requireEmbeddingModel(): string {
  return AI_ASSISTANT_EMBEDDING_MODEL;
}

export function requireSkillsBaseUrl(): string {
  return `${BASE_URL.replace(/\/$/, "")}/agent-skills`;
}

function stripAuthorizationFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const headers = new Headers(init?.headers);
  headers.delete("authorization");
  return fetch(input, { ...init, headers });
}

/**
 * Read-only seam used by tools (e.g. `searchDocs`) that need the
 * configured `OpenAI` client. `ProxyClient` implements this; tests can
 * provide a duck-typed substitute without instantiating the class.
 */
export interface OpenAIProvider {
  readonly openai: OpenAI;
}

/**
 * Owns the lifecycle of the configured `OpenAI` client for the in-browser
 * agent. A single instance is allocated by the worker and threaded through
 * every `AgentSession`.
 */
export class ProxyClient implements OpenAIProvider {
  #client: OpenAI | null = null;
  #lastConfigKey: string | null = null;

  ensureConfigured(config: AiProviderConfig): void {
    const baseURL = config.apiBase.trim().replace(/\/+$/, "");
    const apiKey = config.apiKey.trim();
    if (!baseURL) {
      throw new Error(
        "AI assistant: missing API base URL. Configure it in Settings → AI Configuration.",
      );
    }

    const configKey = JSON.stringify({ baseURL, apiKey });
    if (this.#lastConfigKey === configKey && this.#client) return;

    this.#client = new OpenAI({
      // The OpenAI SDK requires a credential even when a proxy owns auth. Use a
      // placeholder and strip the Authorization header when the user left it blank.
      apiKey: apiKey || "proxy-auth-disabled",
      baseURL,
      dangerouslyAllowBrowser: true,
      ...(apiKey ? {} : { fetch: stripAuthorizationFetch }),
    });
    setDefaultOpenAIClient(this.#client);
    setOpenAIAPI("chat_completions");
    setTracingDisabled(true);
    this.#lastConfigKey = configKey;
  }

  get openai(): OpenAI {
    if (!this.#client) {
      throw new Error(
        "AI assistant: OpenAI client is not configured. proxyClient.ensureConfigured(config) must run first (the dispatcher does this on every turn).",
      );
    }
    return this.#client;
  }
}
