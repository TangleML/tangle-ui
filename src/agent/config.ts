/**
 * Configuration and one-time setup for the in-browser agent.
 *
 * Static values (proxy URL, model names, mode) come from the committed
 * `src/config/aiAssistantConfig.json` file. The secret proxy token is
 * NOT read here — the worker reads it from IndexedDB (via
 * `src/agent/aiTokenStore.ts`, shared with the main thread) on every
 * `ask()` turn and passes the resolved value into
 * `ensureProxyConfigured(token)`, which re-builds the OpenAI client
 * when the token rotates.
 *
 * `proxyMode` exists so a future PR can flip the runtime from
 * `"browser-direct"` (current beta) to `"backend-proxy"` without a
 * rewrite. Only `"browser-direct"` is implemented in this PR.
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

let lastConfiguredToken: string | null = null;

/**
 * Wires the configured LLM proxy as the default OpenAI client for
 * `@openai/agents`. Called once per turn from the dispatcher with the
 * current token. Re-builds the client when the token rotates; otherwise
 * a no-op.
 *
 * - `setOpenAIAPI("chat_completions")`: the proxy exposes Chat
 *   Completions, not the OpenAI Responses API.
 * - `setTracingDisabled(true)`: the SDK's default tracing exporter
 *   would POST to `api.openai.com`, which is unreachable through the
 *   proxy.
 */
export function ensureProxyConfigured(token: string): void {
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
  if (lastConfiguredToken === token) return;
  setDefaultOpenAIClient(
    new OpenAI({
      apiKey: token,
      baseURL: requireProxyBaseUrl(),
      dangerouslyAllowBrowser: true,
    }),
  );
  setOpenAIAPI("chat_completions");
  setTracingDisabled(true);
  lastConfiguredToken = token;
}
