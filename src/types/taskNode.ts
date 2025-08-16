import type {
  ArgumentType,
  ComponentReference,
  TaskSpec,
} from "@/utils/componentSpec";

import type { Annotations } from "./annotations";

export interface TaskNodeData extends Record<string, unknown> {
  taskSpec?: TaskSpec;
  taskId?: string;
  readOnly?: boolean;
  isGhost?: boolean;
  connectable?: boolean;
  highlighted?: boolean;
  callbacks?: TaskNodeCallbacks;
  nodeCallbacks?: NodeCallbacks;
}

export type NodeAndTaskId = {
  taskId: string;
  nodeId: string;
};

export type TaskType = "task" | "input" | "output";

/* Note: Optional callbacks will cause TypeScript to break when applying the callbacks to the Nodes. */
interface TaskNodeCallbacks {
  setArguments: (args: Record<string, ArgumentType>) => void;
  setAnnotations: (annotations: Annotations) => void;
  setCacheStaleness: (cacheStaleness: string | undefined) => void;
  onDelete: () => void;
  onDuplicate: (selected?: boolean) => void;
  onUpgrade: (newComponentRef: ComponentReference) => void;
}

function noop() {}

export const DEFAULT_TASK_NODE_CALLBACKS: TaskNodeCallbacks = {
  setArguments: noop,
  setAnnotations: noop,
  onDelete: noop,
  onDuplicate: noop,
  onUpgrade: noop,
  setCacheStaleness: noop,
};

// Dynamic Node Callback types - every callback has a version with the node & task id added to it as an input parameter
export type CallbackWithIds<K extends keyof TaskNodeCallbacks> =
  TaskNodeCallbacks[K] extends (...args: infer A) => infer R
    ? (ids: NodeAndTaskId, ...args: A) => R
    : never;

export type NodeCallbacks = {
  [K in keyof TaskNodeCallbacks]: CallbackWithIds<K>;
};

export type TaskNodeDimensions = { w: number; h: number | undefined };
