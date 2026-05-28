/**
 * Configuration and proxy-client wiring for the in-browser agent.
 *
 * The single `ProxyClient` instance is owned by the worker (see
 * `src/agent/worker.ts`) and threaded into every `AgentSession` so
 * tools (e.g. `searchDocs`) can read the configured client without
 * touching module-global state.
 *
 * `proxyMode` exists so a future PR can flip the runtime from
 * `"browser-direct"` (current beta) to `"backend-proxy"` without a
 * rewrite.
 */
import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import OpenAI from "openai";

import aiAssistantConfig from "@/config/aiAssistantConfig.json";

export const config = aiAssistantConfig as {
  proxyBaseUrl: string;
  proxyMode: "browser-direct" | "backend-proxy";
  orchestratorModel: string;
  subagentModel: string;
  embeddingModel: string;
  skillsBaseUrl: string;
};

function requireProxyBaseUrl(): string {
  if (!config.proxyBaseUrl) {
    throw new Error(
      "AI assistant: proxyBaseUrl is empty. Set it in src/config/aiAssistantConfig.json before enabling the ai-assistant beta flag.",
    );
  }
  return config.proxyBaseUrl;
}

export function requireOrchestratorModel(): string {
  if (!config.orchestratorModel) {
    throw new Error(
      "AI assistant: orchestratorModel is empty. Set it in src/config/aiAssistantConfig.json.",
    );
  }
  return config.orchestratorModel;
}

export function requireSubagentModel(): string {
  if (!config.subagentModel) {
    throw new Error(
      "AI assistant: subagentModel is empty. Set it in src/config/aiAssistantConfig.json.",
    );
  }
  return config.subagentModel;
}

export function requireEmbeddingModel(): string {
  if (!config.embeddingModel) {
    throw new Error(
      "AI assistant: embeddingModel is empty. Set it in src/config/aiAssistantConfig.json.",
    );
  }
  return config.embeddingModel;
}

export function requireSkillsBaseUrl(): string {
  if (!config.skillsBaseUrl) {
    throw new Error(
      "AI assistant: skillsBaseUrl is empty. Set it in src/config/aiAssistantConfig.json.",
    );
  }
  return config.skillsBaseUrl;
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
 * Owns the lifecycle of the configured `OpenAI` client for the
 * in-browser agent. A single instance is allocated by the worker and
 * threaded through every `AgentSession`.
 *
 * `ensureConfigured(token)` is called once per turn from the
 * dispatcher and re-builds the underlying client when the token
 * rotates; otherwise it is a no-op. The `openai` getter exposes that
 * same client to worker-side tools that need direct API access (e.g.
 * `embeddings.create`) without going through the agent SDK runtime.
 *
 * - `setOpenAIAPI("chat_completions")`: the proxy exposes Chat
 *   Completions, not the OpenAI Responses API.
 * - `setTracingDisabled(true)`: the SDK's default tracing exporter
 *   would POST to `api.openai.com`, which is unreachable through the
 *   proxy.
 */
export class ProxyClient implements OpenAIProvider {
  #client: OpenAI | null = null;
  #lastToken: string | null = null;

  ensureConfigured(token: string): void {
    if (config.proxyMode === "backend-proxy") {
      throw new Error(
        "AI assistant: backend-proxy mode is not implemented yet. Set proxyMode to 'browser-direct' in src/config/aiAssistantConfig.json.",
      );
    }
    if (!token) {
      throw new Error(
        "AI assistant: missing proxy token. Set it via the AI panel.",
      );
    }
    if (this.#lastToken === token && this.#client) return;
    this.#client = new OpenAI({
      apiKey: token,
      baseURL: requireProxyBaseUrl(),
      dangerouslyAllowBrowser: true,
    });
    setDefaultOpenAIClient(this.#client);
    setOpenAIAPI("chat_completions");
    setTracingDisabled(true);
    this.#lastToken = token;
  }

  get openai(): OpenAI {
    if (!this.#client) {
      throw new Error(
        "AI assistant: OpenAI client is not configured. proxyClient.ensureConfigured(token) must run first (the dispatcher does this on every turn).",
      );
    }
    return this.#client;
  }
}
