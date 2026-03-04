import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";

import {
  clearSnapshotTimer,
  useComponentSpecStore,
} from "../componentSpecStore";

const makeTaskSpec = (overrides?: Partial<TaskSpec>): TaskSpec => ({
  componentRef: { name: "test-component" },
  ...overrides,
});

const makeSubgraphTask = (
  nestedSpec: ComponentSpec,
  overrides?: Partial<TaskSpec>,
): TaskSpec => ({
  componentRef: { name: "subgraph-component", spec: nestedSpec },
  ...overrides,
});

const makeSimpleSpec = (): ComponentSpec => ({
  name: "test-pipeline",
  inputs: [{ name: "in1" }],
  outputs: [{ name: "out1" }],
  implementation: {
    graph: {
      tasks: {
        "task-a": makeTaskSpec({ arguments: { x: "hello" } }),
        "task-b": makeTaskSpec({
          arguments: {
            data: { taskOutput: { taskId: "task-a", outputName: "result" } },
          },
        }),
      },
      outputValues: {
        out1: { taskOutput: { taskId: "task-b", outputName: "result" } },
      },
    },
  },
});

describe("componentSpecStore", () => {
  beforeEach(() => {
    clearSnapshotTimer();
    useComponentSpecStore.setState({
      graphs: { root: { tasks: {} } },
      currentSubgraphPath: ["root"],
      isLoading: false,
      _directMutationVersion: 0,
      _history: [],
      _historyIndex: -1,
      _isUndoRedoOperation: false,
    });
  });

  afterEach(() => {
    clearSnapshotTimer();
  });

  describe("loadFromComponentSpec", () => {
    it("decomposes and loads a spec into the store", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      const { graphs } = useComponentSpecStore.getState();
      expect(graphs["root"].name).toBe("test-pipeline");
      expect(Object.keys(graphs["root"].tasks)).toEqual(["task-a", "task-b"]);
    });
  });

  describe("compileComponentSpec", () => {
    it("round-trips through load and compile", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      const compiled = useComponentSpecStore.getState().compileComponentSpec();
      expect(compiled).toStrictEqual(spec);
    });
  });

  describe("setTaskArguments", () => {
    it("updates only the targeted task", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      const taskBBefore =
        useComponentSpecStore.getState().graphs["root"].tasks["task-b"];

      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "updated" });

      const { graphs } = useComponentSpecStore.getState();
      expect(graphs["root"].tasks["task-a"].arguments).toEqual({
        x: "updated",
      });

      // task-b should be the exact same reference (not re-created)
      expect(graphs["root"].tasks["task-b"]).toBe(taskBBefore);
    });
  });

  describe("setTaskAnnotations", () => {
    it("updates task annotations without affecting other tasks", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      const taskABefore =
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"];

      useComponentSpecStore.getState().setTaskAnnotations(["root"], "task-b", {
        display_name: "Task B",
      });

      const { graphs } = useComponentSpecStore.getState();
      expect(graphs["root"].tasks["task-b"].annotations).toEqual({
        display_name: "Task B",
      });
      // task-a unchanged
      expect(graphs["root"].tasks["task-a"]).toBe(taskABefore);
    });
  });

  describe("setTaskExecutionOptions", () => {
    it("sets execution options on a task", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      useComponentSpecStore
        .getState()
        .setTaskExecutionOptions(["root"], "task-a", {
          retryStrategy: { maxRetries: 3 },
          cachingStrategy: { maxCacheStaleness: "P7D" },
        });

      const task =
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"];
      expect(task.executionOptions?.retryStrategy?.maxRetries).toBe(3);
      expect(task.executionOptions?.cachingStrategy?.maxCacheStaleness).toBe(
        "P7D",
      );
    });
  });

  describe("addTask", () => {
    it("adds a new task to the graph", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      useComponentSpecStore
        .getState()
        .addTask(["root"], "task-c", makeTaskSpec());

      const tasks = useComponentSpecStore.getState().graphs["root"].tasks;
      expect(Object.keys(tasks)).toContain("task-c");
    });
  });

  describe("removeTask", () => {
    it("removes a task from the graph", () => {
      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      useComponentSpecStore.getState().removeTask(["root"], "task-a");

      const tasks = useComponentSpecStore.getState().graphs["root"].tasks;
      expect(Object.keys(tasks)).toEqual(["task-b"]);
    });

    it("cleans up nested subgraph entries when removing a subgraph task", () => {
      const nested: ComponentSpec = {
        implementation: {
          graph: {
            tasks: { "inner-task": makeTaskSpec() },
          },
        },
      };

      const spec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              regular: makeTaskSpec(),
              sub: makeSubgraphTask(nested),
            },
          },
        },
      };

      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      // Verify subgraph was decomposed
      expect(useComponentSpecStore.getState().graphs["root>sub"]).toBeDefined();

      // Remove the subgraph task
      useComponentSpecStore.getState().removeTask(["root"], "sub");

      // Nested entry should be cleaned up
      expect(
        useComponentSpecStore.getState().graphs["root>sub"],
      ).toBeUndefined();
    });
  });

  describe("navigation", () => {
    const nestedSpec: ComponentSpec = {
      name: "nested-pipeline",
      inputs: [{ name: "n-in" }],
      implementation: {
        graph: {
          tasks: { "inner-task": makeTaskSpec() },
        },
      },
    };

    const rootSpec: ComponentSpec = {
      implementation: {
        graph: {
          tasks: {
            regular: makeTaskSpec(),
            sub: makeSubgraphTask(nestedSpec),
          },
        },
      },
    };

    it("navigateToSubgraph decomposes lazily and updates path", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(rootSpec);

      useComponentSpecStore.getState().navigateToSubgraph("sub");

      const state = useComponentSpecStore.getState();
      expect(state.currentSubgraphPath).toEqual(["root", "sub"]);
      expect(state.graphs["root>sub"]).toBeDefined();
      expect(state.graphs["root>sub"].name).toBe("nested-pipeline");
      expect(Object.keys(state.graphs["root>sub"].tasks)).toEqual([
        "inner-task",
      ]);
    });

    it("navigateBack pops the path", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(rootSpec);
      useComponentSpecStore.getState().navigateToSubgraph("sub");

      useComponentSpecStore.getState().navigateBack();

      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
      ]);
    });

    it("navigateBack does nothing at root", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(rootSpec);

      useComponentSpecStore.getState().navigateBack();

      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
      ]);
    });

    it("navigateToPath sets an arbitrary path", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(rootSpec);

      useComponentSpecStore.getState().navigateToPath(["root", "sub", "deep"]);

      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
        "sub",
        "deep",
      ]);
    });
  });

  describe("graph-level mutations", () => {
    it("setGraphOutputValues updates output values", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());

      useComponentSpecStore.getState().setGraphOutputValues(["root"], {
        new_output: {
          taskOutput: { taskId: "task-a", outputName: "data" },
        },
      });

      expect(
        useComponentSpecStore.getState().graphs["root"].outputValues,
      ).toEqual({
        new_output: {
          taskOutput: { taskId: "task-a", outputName: "data" },
        },
      });
    });

    it("setGraphInputs updates inputs", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());

      useComponentSpecStore
        .getState()
        .setGraphInputs(["root"], [{ name: "new-input", type: "Integer" }]);

      expect(useComponentSpecStore.getState().graphs["root"].inputs).toEqual([
        { name: "new-input", type: "Integer" },
      ]);
    });
  });

  describe("referential stability", () => {
    it("other tasks keep the same object reference after setTaskArguments", () => {
      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());

      const taskARef1 =
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"];
      const taskBRef1 =
        useComponentSpecStore.getState().graphs["root"].tasks["task-b"];

      // Mutate task-a
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "changed" });

      const taskARef2 =
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"];
      const taskBRef2 =
        useComponentSpecStore.getState().graphs["root"].tasks["task-b"];

      // task-a should be a NEW reference
      expect(taskARef2).not.toBe(taskARef1);
      expect(taskARef2.arguments).toEqual({ x: "changed" });

      // task-b should be the SAME reference (this is the key perf win)
      expect(taskBRef2).toBe(taskBRef1);
    });
  });

  describe("undo/redo", () => {
    it("captures snapshots after debounce and supports undo/redo", () => {
      vi.useFakeTimers();

      const spec = makeSimpleSpec();
      useComponentSpecStore.getState().loadFromComponentSpec(spec);

      // Debounce fires → first snapshot captured
      vi.advanceTimersByTime(600);
      expect(useComponentSpecStore.getState()._historyIndex).toBe(0);

      // Edit task-a
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "edited" });

      // Debounce fires → second snapshot captured
      vi.advanceTimersByTime(600);
      expect(useComponentSpecStore.getState()._historyIndex).toBe(1);
      expect(
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"]
          .arguments,
      ).toEqual({ x: "edited" });

      // Undo → back to original
      useComponentSpecStore.getState().undo();
      expect(
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"]
          .arguments,
      ).toEqual({ x: "hello" });
      expect(useComponentSpecStore.getState()._historyIndex).toBe(0);

      // Redo → back to edited
      useComponentSpecStore.getState().redo();
      expect(
        useComponentSpecStore.getState().graphs["root"].tasks["task-a"]
          .arguments,
      ).toEqual({ x: "edited" });
      expect(useComponentSpecStore.getState()._historyIndex).toBe(1);

      vi.useRealTimers();
    });

    it("undo at start of history does nothing", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600); // capture initial snapshot

      const stateBefore = useComponentSpecStore.getState().graphs;
      useComponentSpecStore.getState().undo(); // can't undo past first snapshot
      const stateAfter = useComponentSpecStore.getState().graphs;

      expect(stateAfter).toBe(stateBefore); // same reference = no change

      vi.useRealTimers();
    });

    it("redo at end of history does nothing", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600);

      const stateBefore = useComponentSpecStore.getState().graphs;
      useComponentSpecStore.getState().redo();
      const stateAfter = useComponentSpecStore.getState().graphs;

      expect(stateAfter).toBe(stateBefore);

      vi.useRealTimers();
    });

    it("new edit after undo truncates redo branch", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600); // snapshot 0: original

      // Edit 1
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "edit1" });
      vi.advanceTimersByTime(600); // snapshot 1: edit1

      // Edit 2
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "edit2" });
      vi.advanceTimersByTime(600); // snapshot 2: edit2

      expect(useComponentSpecStore.getState()._history.length).toBe(3);

      // Undo twice → back to original
      useComponentSpecStore.getState().undo();
      useComponentSpecStore.getState().undo();
      expect(useComponentSpecStore.getState()._historyIndex).toBe(0);

      // New edit → should truncate redo branch
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "diverged" });
      vi.advanceTimersByTime(600);

      expect(useComponentSpecStore.getState()._history.length).toBe(2); // original + diverged
      expect(useComponentSpecStore.getState()._historyIndex).toBe(1);

      // Cannot redo (branch was truncated)
      const indexBefore = useComponentSpecStore.getState()._historyIndex;
      useComponentSpecStore.getState().redo();
      expect(useComponentSpecStore.getState()._historyIndex).toBe(indexBefore);

      vi.useRealTimers();
    });

    it("clearHistory resets history state", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600);

      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "edited" });
      vi.advanceTimersByTime(600);

      expect(useComponentSpecStore.getState()._history.length).toBe(2);

      useComponentSpecStore.getState().clearHistory();

      expect(useComponentSpecStore.getState()._history).toEqual([]);
      expect(useComponentSpecStore.getState()._historyIndex).toBe(-1);

      vi.useRealTimers();
    });

    it("undo cancels pending debounce", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600); // snapshot 0

      // Edit but don't wait for debounce
      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "pending" });

      // Undo immediately (cancels pending debounce)
      useComponentSpecStore.getState().undo();
      // Cannot undo past first snapshot
      expect(useComponentSpecStore.getState()._historyIndex).toBe(0);

      // The pending edit was never captured
      expect(useComponentSpecStore.getState()._history.length).toBe(1);

      vi.useRealTimers();
    });

    it("undo/redo restores subgraph path", () => {
      vi.useFakeTimers();

      const nestedSpec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: { "inner-task": makeTaskSpec() },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              regular: makeTaskSpec(),
              sub: makeSubgraphTask(nestedSpec),
            },
          },
        },
      };

      useComponentSpecStore.getState().loadFromComponentSpec(rootSpec);
      vi.advanceTimersByTime(600); // snapshot 0: at root

      // Navigate into subgraph
      useComponentSpecStore.getState().navigateToSubgraph("sub");
      vi.advanceTimersByTime(600); // snapshot 1: at root>sub

      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
        "sub",
      ]);

      // Undo → back to root path
      useComponentSpecStore.getState().undo();
      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
      ]);

      // Redo → back to subgraph
      useComponentSpecStore.getState().redo();
      expect(useComponentSpecStore.getState().currentSubgraphPath).toEqual([
        "root",
        "sub",
      ]);

      vi.useRealTimers();
    });

    it("undo/redo does not trigger new snapshot capture", () => {
      vi.useFakeTimers();

      useComponentSpecStore.getState().loadFromComponentSpec(makeSimpleSpec());
      vi.advanceTimersByTime(600);

      useComponentSpecStore
        .getState()
        .setTaskArguments(["root"], "task-a", { x: "edited" });
      vi.advanceTimersByTime(600);

      expect(useComponentSpecStore.getState()._history.length).toBe(2);

      useComponentSpecStore.getState().undo();
      vi.advanceTimersByTime(600); // Even after debounce delay, no new snapshot

      expect(useComponentSpecStore.getState()._history.length).toBe(2);
      expect(useComponentSpecStore.getState()._historyIndex).toBe(0);

      vi.useRealTimers();
    });
  });
});
