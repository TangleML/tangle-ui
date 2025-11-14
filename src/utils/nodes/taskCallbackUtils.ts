import type {
  NodeAndTaskId,
  NodeCallbacks,
  TaskCallbacks,
} from "@/types/taskNode";

// Sync TaskCallbacks with NodeCallbacks by injecting nodeId and taskId
export const convertNodeCallbacksToTaskCallbacks = (
  ids: NodeAndTaskId,
  nodeCallbacks?: NodeCallbacks,
): TaskCallbacks => {
  if (!nodeCallbacks) {
    return createEmptyTaskCallbacks();
  }
  return {
    setArguments: (args) => nodeCallbacks.setArguments?.(ids, args),
    setAnnotations: (annotations) =>
      nodeCallbacks.setAnnotations?.(ids, annotations),
    setCacheStaleness: (cacheStaleness) =>
      nodeCallbacks.setCacheStaleness?.(ids, cacheStaleness),
    onDelete: () => nodeCallbacks.onDelete?.(ids),
    onDuplicate: (selected) => nodeCallbacks.onDuplicate?.(ids, selected),
    onUpgrade: (newComponentRef) =>
      nodeCallbacks.onUpgrade?.(ids, newComponentRef),
  };
};

const createEmptyTaskCallbacks = (): TaskCallbacks => ({
  setArguments: () => {},
  setAnnotations: () => {},
  setCacheStaleness: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  onUpgrade: () => {},
});
