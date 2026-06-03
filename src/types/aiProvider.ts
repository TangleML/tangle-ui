export interface AiProviderConfig {
  /** OpenAI-compatible API base URL. Do not include `/chat/completions`. */
  apiBase: string;
  /** Optional bearer token. Leave blank when the proxy owns authentication. */
  apiKey: string;
  /** Optional chat model id. Leave blank to use the default model. */
  model: string;
}
