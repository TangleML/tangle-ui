import { act, cleanup, renderHook } from "@testing-library/react";
import { makeAutoObservable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useRunViewSubgraphExecutionSync,
  useRunViewSubgraphUrlSync,
} from "./useRunViewSubgraphUrlSync";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  execution: {} as {
    runId: string;
    subgraphExecutionId?: string;
    details: { child_task_execution_ids: Record<string, string> };
    segments: { taskId: string; executionId: string; taskName: string }[];
    isLoading?: boolean;
  },
  navigation: undefined as unknown as MockNavigationStore,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => mocks.execution,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: mocks.navigation }),
}));

const ROOT_NAME = "root-pipeline";

class MockNavigationStore {
  rootSpec: { name: string } | null = { name: ROOT_NAME };
  navigationPath = [{ specId: "root", displayName: ROOT_NAME }];

  constructor() {
    makeAutoObservable(this);
  }

  navigateToSubgraph(displayName: string) {
    this.navigationPath = [
      ...this.navigationPath,
      { specId: displayName, displayName },
    ];
  }

  navigateToLevel(index: number) {
    this.navigationPath = this.navigationPath.slice(0, index + 1);
  }

  navigateToPath(displayNames: string[]) {
    this.navigationPath = displayNames.map((name) => ({
      specId: name,
      displayName: name,
    }));
  }

  clearNavigation() {
    this.rootSpec = null;
    this.navigationPath = [];
  }

  initNavigation() {
    this.rootSpec = { name: ROOT_NAME };
    this.navigationPath = [{ specId: "root", displayName: ROOT_NAME }];
  }

  get displayNames() {
    return this.navigationPath.map((entry) => entry.displayName);
  }
}

const firstSegment = {
  taskId: "sub-task",
  executionId: "exec-sub",
  taskName: "Display name of component",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.navigation = new MockNavigationStore();
  mocks.execution = {
    runId: "run-1",
    details: { child_task_execution_ids: { "sub-task": "exec-sub" } },
    segments: [],
  };
});
afterEach(cleanup);

describe("routed run navigation", () => {
  it("enters a subgraph using its execution ID", () => {
    renderHook(() => useRunViewSubgraphUrlSync());
    act(() => mocks.navigation.navigateToSubgraph("sub-task"));
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/runs/run-1/exec-sub",
    });
  });

  it("projects a deep link using task IDs without pushing another URL", () => {
    mocks.execution.subgraphExecutionId = "exec-sub";
    mocks.execution.segments = [firstSegment];
    renderHook(() => useRunViewSubgraphUrlSync());
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("handles browser back and forward without feedback", () => {
    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: "exec-sub",
      segments: [firstSegment],
    };
    const { rerender } = renderHook(() => useRunViewSubgraphUrlSync());

    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: undefined,
      segments: [],
    };
    rerender();
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME]);

    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: "exec-sub",
      segments: [firstSegment],
    };
    rerender();
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the selected execution when the root model is reinitialized", () => {
    mocks.execution.subgraphExecutionId = "exec-sub";
    mocks.execution.segments = [firstSegment];
    renderHook(() => useRunViewSubgraphUrlSync());

    act(() => {
      mocks.navigation.clearNavigation();
      mocks.navigation.initNavigation();
    });

    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("waits for the incoming execution before applying its path", () => {
    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: "exec-sub",
      isLoading: true,
    };
    const { rerender } = renderHook(() => useRunViewSubgraphUrlSync());
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME]);

    mocks.execution = {
      ...mocks.execution,
      isLoading: false,
      segments: [firstSegment],
    };
    rerender();
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("returns to the parent execution from a nested breadcrumb", () => {
    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: "exec-deep",
      segments: [
        firstSegment,
        {
          taskId: "deeper",
          executionId: "exec-deep",
          taskName: "Deeper component",
        },
      ],
    };
    renderHook(() => useRunViewSubgraphUrlSync());
    act(() => mocks.navigation.navigateToLevel(1));
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/runs/run-1/exec-sub",
    });
  });

  it("returns to the root execution", () => {
    mocks.execution.subgraphExecutionId = "exec-sub";
    mocks.execution.segments = [firstSegment];
    renderHook(() => useRunViewSubgraphUrlSync());
    act(() => mocks.navigation.navigateToLevel(0));
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/runs/run-1",
    });
  });

  it("ignores lifecycle cleanup and unresolved child executions", () => {
    renderHook(() => useRunViewSubgraphUrlSync());
    act(() => mocks.navigation.navigateToSubgraph("unresolved"));
    act(() => mocks.navigation.clearNavigation());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("embedded run navigation", () => {
  it("updates only its callback and accepts the resulting execution scope", () => {
    const onExecutionId = vi.fn();
    const { rerender } = renderHook(() =>
      useRunViewSubgraphExecutionSync(onExecutionId),
    );
    act(() => mocks.navigation.navigateToSubgraph("sub-task"));
    expect(onExecutionId).toHaveBeenCalledExactlyOnceWith("exec-sub");

    mocks.execution = {
      ...mocks.execution,
      subgraphExecutionId: "exec-sub",
      segments: [firstSegment],
    };
    rerender();
    expect(mocks.navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    expect(onExecutionId).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
