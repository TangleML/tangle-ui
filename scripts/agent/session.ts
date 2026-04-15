/**
 * Per-request session that isolates all mutable state so concurrent
 * requests never interfere with each other.
 */
import type { EventEmitter } from "events";

import { ComponentSpec, IncrementingIdGenerator } from "@/models/componentSpec";

import type { ComponentSpec as ComponentSpecInterface } from "@/utils/componentSpec";

export interface Command {
  op: string;
  params: Record<string, unknown>;
}

export interface WrappedComponent {
  yaml: string;
  parsed: ComponentSpecInterface;
}

export interface RecentPipelineRun {
  id: string;
  root_execution_id: string;
  created_at: string;
  created_by: string;
  pipeline_name: string;
  status?: string;
}

export interface ComponentRefData {
  id: string;
  name: string;
  description: string;
  yamlText: string;
}

export interface AgentSession {
  threadId: string;
  spec: ComponentSpec;
  idGen: IncrementingIdGenerator;
  commands: Command[];
  emitter: EventEmitter | null;
  wrappedComponents: Map<string, WrappedComponent>;
  recentRuns: RecentPipelineRun[];
  componentReferences: Map<string, ComponentRefData>;
}

export function createSession(params: {
  threadId: string;
  spec?: ComponentSpec;
  emitter?: EventEmitter;
  recentRuns?: RecentPipelineRun[];
}): AgentSession {
  return {
    threadId: params.threadId,
    spec:
      params.spec ??
      new ComponentSpec({
        name: "Untitled Pipeline",
        inputs: [],
        outputs: [],
        tasks: [],
        bindings: [],
      }),
    idGen: new IncrementingIdGenerator(),
    commands: [],
    emitter: params.emitter ?? null,
    wrappedComponents: new Map(),
    recentRuns: params.recentRuns ?? [],
    componentReferences: new Map(),
  };
}

export function recordCommand(session: AgentSession, command: Command): void {
  session.commands.push(command);
  session.emitter?.emit("command", command);
}

export function recordComponentReference(
  session: AgentSession,
  ref: ComponentRefData,
): void {
  session.componentReferences.set(ref.id, ref);
}
