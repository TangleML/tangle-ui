import type { AiProviderRuntimeConfig } from "@/types/aiProvider";

const TANGLE_AI_PROXY_PATH = "/api/experimental/ai/v1";

export function buildTangleAiProxyBaseUrl(backendUrl: string): string {
  const normalizedBackendUrl = backendUrl.trim().replace(/\/+$/, "");
  return normalizedBackendUrl
    ? `${normalizedBackendUrl}${TANGLE_AI_PROXY_PATH}`
    : "";
}

export function getAiRequestOptions(
  config: Pick<AiProviderRuntimeConfig, "apiKey" | "backendAuth">,
): Pick<RequestInit, "credentials" | "headers"> {
  const token = (
    config.backendAuth ? config.backendAuth.token : config.apiKey
  ).trim();
  return {
    credentials: config.backendAuth ? "include" : "omit",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
}
