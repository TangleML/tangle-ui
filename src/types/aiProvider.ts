export interface AiProviderConfig {
  // OpenAI-compatible API base URL, with no endpoint path such as `/responses`.
  apiBase: string;
  // Leave blank when the proxy owns authentication.
  apiKey: string;
  // Leave blank to use the provider default.
  model: string;
  // Include browser authentication when using a backend-managed provider.
  credentials?: RequestCredentials;
}
