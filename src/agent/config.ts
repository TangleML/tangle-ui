import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import OpenAI from "openai";

import type {
  AiProviderConfig,
  AiProviderRuntimeConfig,
} from "@/types/aiProvider";
import { getAiRequestOptions } from "@/utils/aiProxy";
import { BASE_URL } from "@/utils/constants";

const AI_ASSISTANT_EMBEDDING_MODEL = "text-embedding-3-small";
const SIDEKICK_OPENAI_API = "responses";

const RESPONSES_REASONING_INCLUDE = ["reasoning.encrypted_content"];

export function getAgentModelConfig(config: AiProviderConfig): {
  model?: string;
  modelSettings: { providerData: { include: string[] } };
} {
  const model = config.model.trim();
  return {
    ...(model ? { model } : {}),
    modelSettings: {
      providerData: {
        include: RESPONSES_REASONING_INCLUDE,
      },
    },
  };
}

export function requireEmbeddingModel(): string {
  return AI_ASSISTANT_EMBEDDING_MODEL;
}

export function requireSkillsBaseUrl(): string {
  return `${BASE_URL.replace(/\/$/, "")}/agent-skills`;
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

  ensureConfigured(config: AiProviderRuntimeConfig): void {
    const baseURL = config.apiBase.trim().replace(/\/+$/, "");
    const requestOptions = getAiRequestOptions(config);
    if (!baseURL) {
      throw new Error(
        "AI assistant: missing API base URL. Configure it in Settings → AI Configuration.",
      );
    }

    const configKey = JSON.stringify({ baseURL, ...requestOptions });
    if (this.#lastConfigKey === configKey && this.#client) return;

    this.#client = new OpenAI({
      // The SDK requires a key; the transport replaces its placeholder with
      // credentials for the explicitly selected provider on every request.
      apiKey: "proxy-auth-disabled",
      baseURL,
      dangerouslyAllowBrowser: true,
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("authorization");
        new Headers(requestOptions.headers).forEach((value, name) => {
          headers.set(name, value);
        });
        return fetch(input, {
          ...init,
          credentials: requestOptions.credentials,
          headers,
        });
      },
    });
    setDefaultOpenAIClient(this.#client);
    setOpenAIAPI(SIDEKICK_OPENAI_API);
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
