/**
 * Shared types between the worker and the main thread.
 */

export interface ComponentRefData {
  id: string;
  name: string;
  description: string;
  yamlText: string;
}

export interface AgentResponse {
  answer: string;
  threadId: string;
  componentReferences: Record<string, { name: string; yamlText: string }>;
}
