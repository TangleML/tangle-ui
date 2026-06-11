/**
 * Shared types between the worker and the main thread.
 */

/**
 * Page context baked into a worker at init time so the dispatcher and its
 * sub-agents are immediately aware of where they run. Serializable so it
 * crosses the Comlink boundary via structured clone.
 */
export type AgentContext =
  | { mode: "editor" }
  | { mode: "runView"; runId: string; subgraphExecutionId?: string };

export interface AgentResponse {
  answer: string;
  threadId: string;
  componentReferences: Record<string, { name: string; yamlText: string }>;
}

export type StatusCallback = (status: { text: string }) => void;
