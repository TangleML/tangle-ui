export interface AiProviderConfig {
  // OpenAI-compatible API base URL, with no endpoint path such as `/responses`.
  apiBase: string;
  // Leave blank when the proxy owns authentication.
  apiKey: string;
  // Leave blank when the provider owns model selection.
  model: string;
}

export interface AiProviderRuntimeConfig extends AiProviderConfig {
  backendAuth?: { token: string };
}
