/**
 * Shared types between the worker and the main thread.
 */

export interface AgentResponse {
  answer: string;
  threadId: string;
  componentReferences: Record<string, { name: string; yamlText: string }>;
}

export type StatusCallback = (status: { text: string }) => void;
