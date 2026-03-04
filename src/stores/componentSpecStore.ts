import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { isGraphImplementation } from "@/utils/componentSpec";
import { isSubgraph } from "@/utils/subgraphUtils";

import { compileComponentSpec } from "./compile";
import { decomposeComponentSpec } from "./decompose";
import type { ComponentSpecStoreState } from "./types";
import { serializePath } from "./types";

const EMPTY_GRAPH_GRAPHS = {
  root: {
    tasks: {},
  },
};

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 500;

// Module-level debounce timer for snapshot capture
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

export const clearSnapshotTimer = () => {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
};

export const useComponentSpecStore = create<ComponentSpecStoreState>()(
  devtools(
    (set, get) => ({
      graphs: { ...EMPTY_GRAPH_GRAPHS },
      currentSubgraphPath: ["root"],
      isLoading: false,
      _directMutationVersion: 0,

      // Undo/redo history
      _history: [],
      _historyIndex: -1,
      _isUndoRedoOperation: false,

      // ---- Granular task mutations ----

      setTaskSpec: (path, taskId, taskSpec) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                tasks: {
                  ...graph.tasks,
                  [taskId]: taskSpec,
                },
              },
            },
          };
        });
      },

      setTaskArguments: (path, taskId, args) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          const existingTask = graph.tasks[taskId];
          if (!existingTask) return state;

          return {
            _directMutationVersion: state._directMutationVersion + 1,
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                tasks: {
                  ...graph.tasks,
                  [taskId]: {
                    ...existingTask,
                    arguments: args,
                  },
                },
              },
            },
          };
        });
      },

      setTaskAnnotations: (path, taskId, annotations) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          const existingTask = graph.tasks[taskId];
          if (!existingTask) return state;

          return {
            _directMutationVersion: state._directMutationVersion + 1,
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                tasks: {
                  ...graph.tasks,
                  [taskId]: {
                    ...existingTask,
                    annotations,
                  },
                },
              },
            },
          };
        });
      },

      setTaskExecutionOptions: (path, taskId, options) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          const existingTask = graph.tasks[taskId];
          if (!existingTask) return state;

          return {
            _directMutationVersion: state._directMutationVersion + 1,
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                tasks: {
                  ...graph.tasks,
                  [taskId]: {
                    ...existingTask,
                    executionOptions: options,
                  },
                },
              },
            },
          };
        });
      },

      addTask: (path, taskId, taskSpec) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                tasks: {
                  ...graph.tasks,
                  [taskId]: taskSpec,
                },
              },
            },
          };
        });
      },

      removeTask: (path, taskId) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          const { [taskId]: _removed, ...remainingTasks } = graph.tasks;

          // Also clean up any decomposed subgraph entries for this task
          const nestedPrefix = serializePath([...path, taskId]);
          const cleanedGraphs = { ...state.graphs };
          for (const key of Object.keys(cleanedGraphs)) {
            if (key.startsWith(nestedPrefix)) {
              delete cleanedGraphs[key];
            }
          }

          return {
            graphs: {
              ...cleanedGraphs,
              [pathKey]: {
                ...graph,
                tasks: remainingTasks,
              },
            },
          };
        });
      },

      // ---- Graph-level mutations ----

      setGraphOutputValues: (path, outputValues) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                outputValues,
              },
            },
          };
        });
      },

      setGraphInputs: (path, inputs) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                inputs,
              },
            },
          };
        });
      },

      setGraphOutputs: (path, outputs) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                outputs,
              },
            },
          };
        });
      },

      setGraphMetadata: (path, metadata) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                metadata,
              },
            },
          };
        });
      },

      setGraphDescription: (path, description) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          return {
            _directMutationVersion: state._directMutationVersion + 1,
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                description,
              },
            },
          };
        });
      },

      setGraphAnnotation: (path, key, value) => {
        const pathKey = serializePath(path);
        set((state) => {
          const graph = state.graphs[pathKey];
          if (!graph) return state;

          const existingMetadata = graph.metadata ?? {};
          const existingAnnotations = existingMetadata.annotations ?? {};

          return {
            _directMutationVersion: state._directMutationVersion + 1,
            graphs: {
              ...state.graphs,
              [pathKey]: {
                ...graph,
                metadata: {
                  ...existingMetadata,
                  annotations: {
                    ...existingAnnotations,
                    [key]: value,
                  },
                },
              },
            },
          };
        });
      },

      // ---- Bulk operations ----

      loadFromComponentSpec: (spec) => {
        clearSnapshotTimer();
        const { graphs } = decomposeComponentSpec(spec);
        set({ graphs, isLoading: false });
      },

      compileComponentSpec: () => {
        const { graphs } = get();
        return compileComponentSpec(graphs);
      },

      // ---- Navigation ----

      navigateToSubgraph: (taskId) => {
        set((state) => {
          const newPath = [...state.currentSubgraphPath, taskId];
          const newPathKey = serializePath(newPath);

          // Already decomposed
          if (state.graphs[newPathKey]) {
            return { currentSubgraphPath: newPath };
          }

          // Get the task's nested spec and decompose it lazily
          const parentPathKey = serializePath(state.currentSubgraphPath);
          const task = state.graphs[parentPathKey]?.tasks[taskId];

          if (!task || !isSubgraph(task) || !task.componentRef?.spec) {
            console.warn(
              `Cannot navigate: task ${taskId} is not a subgraph or has no spec`,
            );
            return state;
          }

          const nestedSpec = task.componentRef.spec;
          if (!isGraphImplementation(nestedSpec.implementation)) {
            console.warn(
              `Cannot navigate: task ${taskId} does not have a graph implementation`,
            );
            return state;
          }

          const { graphs: decomposed } = decomposeComponentSpec(
            nestedSpec,
            newPath,
          );

          return {
            currentSubgraphPath: newPath,
            graphs: {
              ...state.graphs,
              ...decomposed,
            },
          };
        });
      },

      navigateBack: () => {
        set((state) => {
          if (state.currentSubgraphPath.length <= 1) return state;
          return {
            currentSubgraphPath: state.currentSubgraphPath.slice(0, -1),
          };
        });
      },

      navigateToPath: (path) => {
        set({ currentSubgraphPath: path });
      },

      // ---- Undo/redo ----

      undo: () => {
        clearSnapshotTimer();
        const { _history, _historyIndex, _directMutationVersion } = get();
        if (_historyIndex <= 0) return;

        const newIndex = _historyIndex - 1;
        const snapshot = _history[newIndex];

        set({
          _isUndoRedoOperation: true,
          graphs: structuredClone(snapshot.graphs),
          currentSubgraphPath: [...snapshot.currentSubgraphPath],
          _historyIndex: newIndex,
          _directMutationVersion: _directMutationVersion + 1,
        });

        // Reset flag after subscribers have processed the change
        set({ _isUndoRedoOperation: false });
      },

      redo: () => {
        clearSnapshotTimer();
        const { _history, _historyIndex, _directMutationVersion } = get();
        if (_historyIndex >= _history.length - 1) return;

        const newIndex = _historyIndex + 1;
        const snapshot = _history[newIndex];

        set({
          _isUndoRedoOperation: true,
          graphs: structuredClone(snapshot.graphs),
          currentSubgraphPath: [...snapshot.currentSubgraphPath],
          _historyIndex: newIndex,
          _directMutationVersion: _directMutationVersion + 1,
        });

        // Reset flag after subscribers have processed the change
        set({ _isUndoRedoOperation: false });
      },

      clearHistory: () => {
        clearSnapshotTimer();
        set({ _history: [], _historyIndex: -1 });
      },

      _captureSnapshot: () => {
        set((state) => {
          const snapshot = {
            graphs: structuredClone(state.graphs),
            currentSubgraphPath: [...state.currentSubgraphPath],
          };

          // Truncate redo branch
          let history = state._history.slice(0, state._historyIndex + 1);
          history.push(snapshot);

          // Enforce max size
          if (history.length > MAX_HISTORY) {
            history = history.slice(history.length - MAX_HISTORY);
          }

          return {
            _history: history,
            _historyIndex: history.length - 1,
          };
        });
      },
    }),
    { name: "ComponentSpecStore" },
  ),
);

// Auto-capture debounced snapshots when graphs or subgraph path change (excluding undo/redo)
useComponentSpecStore.subscribe((state, prevState) => {
  const graphsChanged = state.graphs !== prevState.graphs;
  const pathChanged =
    state.currentSubgraphPath !== prevState.currentSubgraphPath;

  if ((graphsChanged || pathChanged) && !state._isUndoRedoOperation) {
    clearSnapshotTimer();
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      useComponentSpecStore.getState()._captureSnapshot();
    }, DEBOUNCE_MS);
  }
});
