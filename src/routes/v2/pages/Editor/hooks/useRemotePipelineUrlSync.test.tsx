import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { observer } from "mobx-react-lite";
import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { Output } from "@/models/componentSpec/entities/output";
import { Task } from "@/models/componentSpec/entities/task";
import { APP_ROUTES } from "@/routes/appRoutes";
import { validateRemotePipelineSearch } from "@/routes/remotePipelineSearch";
import {
  SharedStoreProvider,
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { useRemotePipelineUrlSync } from "./useRemotePipelineUrlSync";

const notify = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

beforeEach(() => {
  notify.mockClear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const outerName = "Prepare / café?";
const innerName = 'Train & validate "final"';
const targetName = "shared / result?";

function makeGraph() {
  const leaf = new ComponentSpec({
    name: "Leaf implementation",
    tasks: [new Task({ name: targetName, componentRef: { name: "Task" } })],
    inputs: [new Input({ name: targetName })],
    outputs: [new Output({ name: targetName })],
  });
  const innerTask = new Task({
    name: innerName,
    componentRef: { name: "Inner" },
    subgraphSpec: leaf,
  });
  const nested = new ComponentSpec({
    name: "Nested implementation",
    tasks: [innerTask],
  });
  const outerTask = new Task({
    name: outerName,
    componentRef: { name: "Outer" },
    subgraphSpec: nested,
  });
  const root = new ComponentSpec({
    name: "Original pipeline",
    tasks: [
      outerTask,
      new Task({ name: targetName, componentRef: { name: "Root task" } }),
    ],
  });
  return { root, nested, leaf, outerTask, innerTask };
}

function remoteLink(search: Record<string, unknown> = {}) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(search)) {
    query.set(name, typeof value === "string" ? value : JSON.stringify(value));
  }
  return `/editor/pipeline/remote-1${query.size ? `?${query}` : ""}`;
}

const Harness = observer(function Harness({
  spec,
  enabled,
  documentPipelineId,
  onStores,
}: {
  spec: ComponentSpec;
  enabled: boolean;
  documentPipelineId?: string;
  onStores: (stores: SharedUIStore) => void;
}) {
  const stores = useSharedStores();
  const params = useRouterState({
    select: (state) => state.matches.at(-1)?.params,
  });
  const pipelineId =
    documentPipelineId ??
    (enabled && params && "pipelineId" in params
      ? params.pipelineId
      : undefined);

  useEffect(() => {
    stores.navigation.initNavigation(spec);
    onStores(stores);
    return () => {
      stores.navigation.clearNavigation();
      stores.editor.resetState();
    };
  }, [spec, stores, onStores]);

  useRemotePipelineUrlSync(spec, pipelineId);
  return null;
});

async function openEditor({
  graph = makeGraph(),
  search = {},
  enabled = true,
  strict = false,
  documentPipelineId,
}: {
  graph?: ReturnType<typeof makeGraph>;
  search?: Record<string, unknown>;
  enabled?: boolean;
  strict?: boolean;
  documentPipelineId?: string;
} = {}) {
  let mountedStores: SharedUIStore | undefined;
  const onStores = (stores: SharedUIStore) => {
    mountedStores = stores;
  };
  const rootRoute = createRootRoute({
    component: () => (
      <SharedStoreProvider>
        <Outlet />
      </SharedStoreProvider>
    ),
  });
  const pipelineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    validateSearch: validateRemotePipelineSearch,
    component: () => (
      <Harness
        spec={graph.root}
        enabled={enabled}
        documentPipelineId={documentPipelineId}
        onStores={onStores}
      />
    ),
  });
  const history = createMemoryHistory({
    initialEntries: [remoteLink(search)],
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pipelineRoute]),
    history,
  });
  await router.load();
  const rendered = render(
    strict ? (
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    ) : (
      <RouterProvider router={router} />
    ),
  );
  await waitFor(() => expect(mountedStores).toBeDefined());
  if (!mountedStores) throw new Error("Editor stores were not initialized");
  return { ...rendered, ...graph, router, history, stores: mountedStores };
}

describe("useRemotePipelineUrlSync", () => {
  it("opens and focuses a nested task by saved names while preserving unrelated search", async () => {
    const { stores, leaf, router, history } = await openEditor({
      search: {
        subgraphPath: [outerName, innerName],
        nodeId: targetName,
        nodeType: "task",
        projectId: "project-1",
        panel: "details",
      },
    });

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(leaf);
      expect(stores.editor.selectedNodeId).toBe(leaf.tasks[0].$id);
      expect(stores.editor.selectedNodeType).toBe("task");
      expect(stores.editor.pendingFocusNodeId).toBe(leaf.tasks[0].$id);
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, innerName],
        projectId: "project-1",
        panel: "details",
        nodeId: targetName,
        nodeType: "task",
      });
    });
    expect(history.length).toBe(1);
  });

  it.each(["input", "output"] as const)(
    "uses nodeType to distinguish a nested %s from a task with the same name",
    async (nodeType) => {
      const { stores, leaf } = await openEditor({
        search: {
          subgraphPath: [outerName, innerName],
          nodeId: targetName,
          nodeType,
        },
      });
      const entity = nodeType === "input" ? leaf.inputs[0] : leaf.outputs[0];

      await waitFor(() => {
        expect(stores.editor.selectedNodeId).toBe(entity.$id);
        expect(stores.editor.selectedNodeType).toBe(nodeType);
        expect(stores.editor.pendingFocusNodeId).toBe(entity.$id);
      });
    },
  );

  it("supports run-style links without a node type, preferring tasks", async () => {
    const { stores, root } = await openEditor({
      search: { nodeId: targetName },
    });

    await waitFor(() => {
      expect(stores.editor.selectedNodeId).toBe(root.tasks[1].$id);
      expect(stores.editor.selectedNodeType).toBe("task");
    });
  });

  it.each(["42", "true", "false"])(
    "opens an unquoted node named %s",
    async (name) => {
      const graph = makeGraph();
      graph.root.tasks[1].setName(name);
      const { stores, router } = await openEditor({
        graph,
        search: { nodeId: name },
      });
      expect(stores.editor.selectedNodeId).toBe(graph.root.tasks[1].$id);
      expect(String(router.state.location.search.nodeId)).toBe(name);
    },
  );

  it("accepts numeric and boolean subgraph names parsed from a hand-written URL", async () => {
    const graph = makeGraph();
    graph.outerTask.setName("42");
    graph.innerTask.setName("true");
    const { stores, router } = await openEditor({
      graph,
      search: { subgraphPath: [42, true], nodeId: targetName },
    });
    expect(stores.navigation.activeSpec).toBe(graph.leaf);
    expect(stores.editor.selectedNodeId).toBe(graph.leaf.tasks[0].$id);
    expect(router.state.location.search.subgraphPath).toEqual(["42", "true"]);
  });

  it("replaces the current entry when a deleted subgraph corrects navigation", async () => {
    const { stores, root, nested, outerTask, innerTask, router, history } =
      await openEditor({
        search: { subgraphPath: [outerName, innerName] },
      });
    act(() => {
      nested.removeTaskById(innerTask.$id);
      stores.navigation.correctInvalidNavigation();
    });
    await waitFor(() =>
      expect(router.state.location.search.subgraphPath).toEqual([outerName]),
    );
    expect(stores.navigation.activeSpec).toBe(nested);
    expect(history.length).toBe(1);
    act(() => stores.navigation.navigateBack());
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(root));
    expect(history.length).toBe(2);
    expect(outerTask.subgraphSpec).toBe(nested);
  });

  it("pushes subgraph navigation and restores it through browser Back and Forward", async () => {
    const {
      stores,
      root,
      nested,
      leaf,
      outerTask,
      innerTask,
      router,
      history,
    } = await openEditor({ search: { projectId: "project-1" } });

    expect(history.length).toBe(1);
    act(() => stores.navigation.navigateToSubgraph(root, outerTask.$id));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName],
        projectId: "project-1",
      }),
    );
    act(() => stores.navigation.navigateToSubgraph(nested, innerTask.$id));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, innerName],
        projectId: "project-1",
      }),
    );
    expect(history.length).toBe(3);

    await act(async () => {
      history.back();
      await router.load();
    });
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(nested));
    await act(async () => {
      history.back();
      await router.load();
    });
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(root));
    await act(async () => {
      history.forward();
      await router.load();
    });
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(nested));
    await act(async () => {
      history.forward();
      await router.load();
    });
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(leaf));
    expect(history.length).toBe(3);
  });

  it("falls back to the deepest existing graph for a stale subgraph link", async () => {
    const { stores, nested, router, history } = await openEditor({
      search: {
        subgraphPath: [outerName, "deleted task", innerName],
        nodeId: targetName,
        nodeType: "task",
        projectId: "project-1",
      },
    });

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(nested);
      expect(stores.editor.selectedNodeId).toBeNull();
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName],
        projectId: "project-1",
      });
    });
    expect(history.length).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      "The linked subgraph is no longer in this pipeline. Opened its nearest available parent.",
      "warning",
    );
  });

  it("keeps the graph usable when the linked node has been removed", async () => {
    const { stores, leaf, router } = await openEditor({
      search: {
        subgraphPath: [outerName, innerName],
        nodeId: "deleted node",
        nodeType: "output",
        projectId: "project-1",
      },
    });

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(leaf);
      expect(stores.editor.selectedNodeId).toBeNull();
      expect(stores.editor.pendingFocusNodeId).toBeNull();
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, innerName],
        projectId: "project-1",
      });
    });
  });

  it("ignores URL targets belonging to a different pipeline than the mounted document", async () => {
    const search = {
      subgraphPath: [outerName, innerName],
      nodeId: targetName,
      nodeType: "task",
    };
    const { stores, root, outerTask, router, history } = await openEditor({
      search,
      documentPipelineId: "embedded-remote",
    });
    expect(stores.navigation.activeSpec).toBe(root);
    expect(stores.editor.selectedNodeId).toBeNull();
    act(() => stores.navigation.navigateToSubgraph(root, outerTask.$id));
    expect(router.state.location.search).toEqual(search);
    expect(history.length).toBe(1);
  });

  it("ignores URL state and navigation changes when remote linking is disabled", async () => {
    const search = {
      subgraphPath: [outerName, innerName],
      nodeId: targetName,
      nodeType: "task",
    };
    const { stores, root, outerTask, router, history } = await openEditor({
      search,
      enabled: false,
    });

    expect(stores.navigation.activeSpec).toBe(root);
    expect(stores.editor.selectedNodeId).toBeNull();
    act(() => stores.navigation.navigateToSubgraph(root, outerTask.$id));
    expect(router.state.location.search).toEqual(search);
    expect(history.length).toBe(1);
  });

  it("preserves a nested URL across StrictMode lifecycle cleanup and unmount", async () => {
    const { stores, leaf, router, history, unmount } = await openEditor({
      search: {
        subgraphPath: [outerName, innerName],
        nodeId: targetName,
        nodeType: "input",
      },
      strict: true,
    });

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(leaf);
      expect(stores.editor.selectedNodeId).toBe(leaf.inputs[0].$id);
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, innerName],
        nodeId: targetName,
        nodeType: "input",
      });
    });
    const href = router.state.location.href;
    unmount();
    expect(history.location.href).toBe(href);
    expect(history.length).toBe(1);
  });

  it("opens another node link without remounting the current pipeline", async () => {
    const { stores, root, leaf, router, history } = await openEditor({
      search: { nodeId: targetName },
    });
    await waitFor(() =>
      expect(stores.editor.selectedNodeId).toBe(root.tasks[1].$id),
    );

    await act(async () => {
      await router.navigate({
        to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
        params: { pipelineId: "remote-1" },
        search: {
          subgraphPath: [outerName, innerName],
          nodeId: targetName,
          nodeType: "output",
        },
      });
    });

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(leaf);
      expect(stores.editor.selectedNodeId).toBe(leaf.outputs[0].$id);
      expect(stores.editor.pendingFocusNodeId).toBe(leaf.outputs[0].$id);
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, innerName],
        nodeId: targetName,
        nodeType: "output",
      });
    });
    expect(history.length).toBe(2);
  });

  it("updates the nested URL when the current subgraph is renamed", async () => {
    const { stores, leaf, router, history } = await openEditor({
      search: {
        subgraphPath: [outerName, innerName],
        projectId: "project-1",
      },
    });
    await waitFor(() => expect(stores.navigation.activeSpec).toBe(leaf));

    act(() => stores.navigation.renameCurrentSubgraph("Renamed / subgraph"));

    await waitFor(() => {
      expect(stores.navigation.activeSpec).toBe(leaf);
      expect(router.state.location.search).toEqual({
        subgraphPath: [outerName, "Renamed / subgraph"],
        projectId: "project-1",
      });
    });
    expect(history.length).toBe(1);
  });

  it("resolves a link after the root pipeline is renamed without adding history entries", async () => {
    const graph = makeGraph();
    graph.root.setName("Renamed pipeline");
    const { stores, leaf, history } = await openEditor({
      graph,
      search: { subgraphPath: [outerName, innerName] },
    });

    await waitFor(() => expect(stores.navigation.activeSpec).toBe(leaf));
    expect(stores.navigation.navigationPath[0].displayName).toBe(
      "Renamed pipeline",
    );
    expect(history.length).toBe(1);
  });
});
