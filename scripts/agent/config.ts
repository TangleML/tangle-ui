import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  proxyBaseUrl: process.env.AI_PROXY_BASE_URL ?? "https://proxy.shopify.ai/v1",
  apiKey: () => requireEnv("OPENAI_API_KEY"),
  port: Number(process.env.AGENT_PORT ?? "4100"),
  tangleApiUrl: process.env.TANGLE_API_URL ?? "http://localhost:8000",
  orchestratorModel: process.env.ORCHESTRATOR_MODEL ?? "claude-sonnet-4-6",
  subagentModel: process.env.SUBAGENT_MODEL ?? "claude-haiku-4-5",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  vectorStorePath:
    process.env.VECTOR_STORE_PATH ??
    "scripts/agent/registry/.vector-store.json",
  docsVectorStorePath:
    process.env.DOCS_VECTOR_STORE_PATH ??
    "scripts/agent/registry/.docs-vector-store.json",
  verbose: (process.env.AGENT_VERBOSE ?? "true") === "true",
} as const;

export function createProxyModel(
  modelName?: string,
  options?: { temperature?: number },
): ChatOpenAI {
  const apiKey = config.apiKey();
  return new ChatOpenAI({
    model: modelName ?? config.orchestratorModel,
    temperature: options?.temperature ?? 0.2,
    apiKey,
    configuration: {
      baseURL: config.proxyBaseUrl,
      defaultHeaders: { "X-Shopify-Access-Token": apiKey },
    },
  });
}

export function createProxyEmbeddings(): OpenAIEmbeddings {
  const apiKey = config.apiKey();
  return new OpenAIEmbeddings({
    model: config.embeddingModel,
    apiKey,
    configuration: {
      baseURL: config.proxyBaseUrl,
      defaultHeaders: { "X-Shopify-Access-Token": apiKey },
    },
  });
}
