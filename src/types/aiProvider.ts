export interface AiProviderConfig {
  /** OpenAI-compatible API base URL. Do not include endpoint paths like `/responses`. */
  apiBase: string;
  /** Optional bearer token. Leave blank when the proxy owns authentication. */
  apiKey: string;
  /** Optional generation model id. Leave blank to use the provider default. */
  model: string;
}
