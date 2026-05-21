/**
 * Browser-side agent configuration. Mirrors `scripts/agent/config.ts` but
 * sources values from `import.meta.env` instead of `process.env`.
 *
 * Per the experiment scope, the proxy token is exposed to the browser;
 * securing it is out of scope.
 *
 * Configures `@openai/agents` to talk to the Shopify proxy via the OpenAI
 * client (the proxy exposes Anthropic / Claude models through the OpenAI
 * Chat Completions surface).
 */
import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import OpenAI from "openai";

interface AgentEnv {
  VITE_AI_PROXY_BASE_URL?: string;
  VITE_AI_PROXY_TOKEN?: string;
  VITE_AGENT_ORCHESTRATOR_MODEL?: string;
  VITE_AGENT_SUBAGENT_MODEL?: string;
  VITE_BACKEND_API_URL?: string;
  VITE_AGENT_SKILLS_BASE_URL?: string;
}

const env = (import.meta.env ?? {}) as unknown as AgentEnv;

function requireToken(): string {
  const token = env.VITE_AI_PROXY_TOKEN;
  if (!token) {
    throw new Error(
      "VITE_AI_PROXY_TOKEN is not set. The in-browser agent cannot reach the LLM proxy without it.",
    );
  }
  return token;
}

export const config = {
  proxyBaseUrl: env.VITE_AI_PROXY_BASE_URL ?? "https://proxy.shopify.ai/v1",
  orchestratorModel: env.VITE_AGENT_ORCHESTRATOR_MODEL ?? "claude-sonnet-4-6",
  subagentModel: env.VITE_AGENT_SUBAGENT_MODEL ?? "claude-haiku-4-5",
  tangleApiUrl: env.VITE_BACKEND_API_URL ?? "http://localhost:8000",
  skillsBaseUrl: env.VITE_AGENT_SKILLS_BASE_URL ?? "/agent-skills",
} as const;

let configured = false;

/**
 * Wires the Shopify proxy as the default OpenAI client for `@openai/agents`.
 * Idempotent — safe to call from every `ask()` turn.
 *
 * - `setOpenAIAPI("chat_completions")`: Claude models reach us through the
 *   proxy's Chat Completions surface, not the OpenAI Responses API.
 * - `setTracingDisabled(true)`: the OpenAI tracing exporter would otherwise
 *   try to POST to `api.openai.com`, which is unreachable through the proxy.
 */
export function ensureProxyConfigured(): void {
  if (configured) return;
  const apiKey = requireToken();
  setDefaultOpenAIClient(
    new OpenAI({
      apiKey,
      baseURL: config.proxyBaseUrl,
      defaultHeaders: { "X-Shopify-Access-Token": apiKey },
      dangerouslyAllowBrowser: true,
    }),
  );
  setOpenAIAPI("chat_completions");
  setTracingDisabled(true);
  configured = true;
}
