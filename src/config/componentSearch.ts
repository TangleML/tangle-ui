import type {
  AiProviderConfig,
  ComponentRerankConfig,
} from "@/types/aiProvider";

export function getComponentSearchConfig(
  config: AiProviderConfig,
  provider: ComponentRerankConfig["provider"],
): ComponentRerankConfig {
  const base = config.apiBase.trim().replace(/\/+$/, "");
  if (provider === "responses") {
    return { ...config, apiBase: base, provider };
  }
  return {
    provider,
    apiBase: base ? `${base.replace(/\/v1$/, "")}/vendors/typesafe/v1` : "",
    apiKey: config.apiKey,
    model: "jev-1.13.0",
    ...(config.credentials ? { credentials: config.credentials } : {}),
  };
}
