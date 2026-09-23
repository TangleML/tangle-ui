const TANGLE_AI_PROXY_PATH = "/api/experimental/ai/v1";

export function buildTangleAiProxyBaseUrl(backendUrl: string): string {
  const normalizedBackendUrl = backendUrl.trim().replace(/\/+$/, "");
  return normalizedBackendUrl
    ? `${normalizedBackendUrl}${TANGLE_AI_PROXY_PATH}`
    : "";
}

export function isTangleAiProxyBaseUrl(apiBase: string): boolean {
  return apiBase.trim().replace(/\/+$/, "").endsWith(TANGLE_AI_PROXY_PATH);
}
