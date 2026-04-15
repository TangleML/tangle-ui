import type { PipelineRun } from "@/types/pipelineRun";

import type { AiSpec } from "./serializeSpecForAi";

export interface ComponentRefData {
  name: string;
  yamlText: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  commands?: Command[];
  componentReferences?: Record<string, ComponentRefData>;
}

export interface AiChatRequest {
  message: string;
  context?: string;
  currentSpec?: AiSpec;
  selectedEntityId?: string;
  threadId?: string;
  recentRuns?: PipelineRun[];
}

export interface Command {
  op: string;
  params: Record<string, unknown>;
  componentYaml?: string;
}

export interface SseCommandEvent {
  op: string;
  params: Record<string, unknown>;
  componentYaml?: string;
}

export interface SseStatusEvent {
  text: string;
}

export interface SseDoneEvent {
  answer: string;
  threadId: string;
  componentReferences?: Record<string, ComponentRefData>;
}
