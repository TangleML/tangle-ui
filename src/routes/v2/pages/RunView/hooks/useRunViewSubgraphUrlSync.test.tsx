import { act, cleanup, renderHook } from "@testing-library/react";
import { makeAutoObservable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRunViewSubgraphUrlSync } from "./useRunViewSubgraphUrlSync";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as Record<string, unknown>,
}));

const executionDataMock = vi.hoisted(() => ({
  // Loosely typed on purpose: the hook only reads a small slice of the
  // execution data context, so tests provide just those fields.
  current: {} as {
    runId?: string | null;
    details?: { child_task_execution_ids?: Record<string, string> };
    segments?: { taskId: string; executionId: string; taskName: string }[];
  },
}));

const sharedStoreMock = vi.hoisted(() => ({
  navigation: undefined as unknown as MockNavigationStore,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useParams: () => routerMocks.params,
  };
});

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => executionDataMock.current,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: sharedStoreMock.navigation }),
}));

const ROOT_NAME = "root-pipeline";

/**
 * Minimal observable stand-in for the V2 NavigationStore exposing just the
 * surface the hook touches (`navigationPath`, `rootSpec`, and the navigation
 * actions). Reassigning `navigationPath` triggers the hook's mobx reaction.
 */
class MockNavigationStore {
  navigationPath: { specId: string; displayName: string }[];
  rootSpec: { name: string } | null;

  constructor(rootName = ROOT_NAME) {
    this.rootSpec = { name: rootName };
    this.navigationPath = [{ specId: "root", displayName: rootName }];
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
    this.navigationPath = [];
  }

  get displayNames() {
    return this.navigationPath.map((entry) => entry.displayName);
  }
}

const renderSyncHook = () => renderHook(() => useRunViewSubgraphUrlSync());

describe("useRunViewSubgraphUrlSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.params = {};
    sharedStoreMock.navigation = new MockNavigationStore();
    executionDataMock.current = {
      runId: "run-1",
      details: { child_task_execution_ids: {} },
      segments: [],
    };
  });

  afterEach(cleanup);

  it("does not navigate on mount at the root level", () => {
    renderSyncHook();

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("pushes the child execution id onto the URL when entering a subgraph", () => {
    executionDataMock.current.details = {
      child_task_execution_ids: { "sub-task": "exec-sub" },
    };

    const navigation = sharedStoreMock.navigation;
    renderSyncHook();

    act(() => navigation.navigateToSubgraph("sub-task"));

    expect(routerMocks.navigate).toHaveBeenCalledTimes(1);
    expect(routerMocks.navigate).toHaveBeenCalledWith({
      to: "/runs-v2/run-1/exec-sub",
    });
  });

  it("does not navigate when the child execution id cannot be resolved", () => {
    executionDataMock.current.details = { child_task_execution_ids: {} };

    const navigation = sharedStoreMock.navigation;
    renderSyncHook();

    act(() => navigation.navigateToSubgraph("sub-task"));

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("drops the subgraph segment when navigating back to the root", () => {
    const navigation = sharedStoreMock.navigation;
    navigation.navigateToSubgraph("sub-task");

    renderSyncHook();

    act(() => navigation.navigateToLevel(0));

    expect(routerMocks.navigate).toHaveBeenCalledTimes(1);
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: "/runs-v2/run-1" });
  });

  it("resolves the target execution id from breadcrumb segments when going shallower", () => {
    executionDataMock.current.segments = [
      { taskId: "t-a", executionId: "exec-a", taskName: "a" },
      { taskId: "t-b", executionId: "exec-b", taskName: "b" },
    ];

    const navigation = sharedStoreMock.navigation;
    navigation.navigateToSubgraph("a");
    navigation.navigateToSubgraph("b");

    renderSyncHook();

    act(() => navigation.navigateToLevel(1));

    expect(routerMocks.navigate).toHaveBeenCalledTimes(1);
    expect(routerMocks.navigate).toHaveBeenCalledWith({
      to: "/runs-v2/run-1/exec-a",
    });
  });

  it("syncs the navigation store from an external subgraph URL without pushing back", () => {
    routerMocks.params = { subgraphExecutionId: "exec-sub" };
    executionDataMock.current.segments = [
      { taskId: "t-sub", executionId: "exec-sub", taskName: "sub-task" },
    ];

    const navigation = sharedStoreMock.navigation;
    renderSyncHook();

    expect(navigation.displayNames).toEqual([ROOT_NAME, "sub-task"]);
    // The URL already matches, so direction A must not push a redundant nav.
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("does not push a root URL when the navigation store is cleared (unmount / StrictMode remount)", () => {
    executionDataMock.current.segments = [
      { taskId: "t-sub", executionId: "exec-sub", taskName: "sub-task" },
    ];

    const navigation = sharedStoreMock.navigation;
    navigation.navigateToSubgraph("sub-task");

    renderSyncHook();

    // Simulates the spec-lifecycle cleanup emptying the path while the
    // direction A reaction is still active.
    act(() => navigation.clearNavigation());

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("does not resync the navigation store while breadcrumb segments are still loading", () => {
    routerMocks.params = { subgraphExecutionId: "exec-sub" };
    executionDataMock.current.segments = [];

    const navigation = sharedStoreMock.navigation;
    renderSyncHook();

    expect(navigation.displayNames).toEqual([ROOT_NAME]);
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });
});
