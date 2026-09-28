import type {
  AiProviderConfig,
  ComponentRerankConfig,
} from "@/types/aiProvider";

/** Native Jev requests share the AI proxy's connection and authentication. */
export function getComponentSearchConfig(
  config: AiProviderConfig,
): ComponentRerankConfig {
  const base = config.apiBase.trim().replace(/\/+$/, "");
  return {
    provider: "jev",
    apiBase: base ? `${base.replace(/\/v1$/, "")}/vendors/typesafe/v1` : "",
    apiKey: config.apiKey,
    model: "jev-1.13.0",
    ...(config.credentials ? { credentials: config.credentials } : {}),
  };
}
