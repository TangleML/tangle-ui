import type {
  ArgumentType,
  ComponentSpec,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";

export interface NormalizedGraphLevel {
  name?: string;
  description?: string;
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
  metadata?: MetadataSpec;
  tasks: Record<string, TaskSpec>;
  outputValues?: Record<string, TaskOutputArgument>;
}

export interface HistorySnapshot {
  graphs: Record<string, NormalizedGraphLevel>;
  currentSubgraphPath: string[];
}

export interface ComponentSpecStoreState {
  graphs: Record<string, NormalizedGraphLevel>;
  currentSubgraphPath: string[];
  isLoading: boolean;

  // Incremented on direct store mutations so the bridge layer knows to skip re-decomposition
  _directMutationVersion: number;

  // Undo/redo history
  _history: HistorySnapshot[];
  _historyIndex: number;
  _isUndoRedoOperation: boolean;

  // Granular task mutations
  setTaskSpec: (path: string[], taskId: string, taskSpec: TaskSpec) => void;
  setTaskArguments: (
    path: string[],
    taskId: string,
    args: Record<string, ArgumentType>,
  ) => void;
  setTaskAnnotations: (
    path: string[],
    taskId: string,
    annotations: Record<string, unknown>,
  ) => void;
  setTaskExecutionOptions: (
    path: string[],
    taskId: string,
    options: TaskSpec["executionOptions"],
  ) => void;
  addTask: (path: string[], taskId: string, taskSpec: TaskSpec) => void;
  removeTask: (path: string[], taskId: string) => void;

  // Graph-level mutations
  setGraphOutputValues: (
    path: string[],
    outputValues: Record<string, TaskOutputArgument>,
  ) => void;
  setGraphInputs: (path: string[], inputs: InputSpec[]) => void;
  setGraphOutputs: (path: string[], outputs: OutputSpec[]) => void;
  setGraphMetadata: (path: string[], metadata: MetadataSpec) => void;
  setGraphDescription: (
    path: string[],
    description: string | undefined,
  ) => void;
  setGraphAnnotation: (path: string[], key: string, value: string) => void;

  // Bulk operations
  loadFromComponentSpec: (spec: ComponentSpec) => void;
  compileComponentSpec: () => ComponentSpec;

  // Navigation
  navigateToSubgraph: (taskId: string) => void;
  navigateBack: () => void;
  navigateToPath: (path: string[]) => void;

  // Undo/redo actions
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  _captureSnapshot: () => void;
}

export const serializePath = (path: string[]): string => path.join(">");
