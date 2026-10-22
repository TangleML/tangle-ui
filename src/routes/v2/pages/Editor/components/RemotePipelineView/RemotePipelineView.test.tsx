import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactFlowProps } from "@xyflow/react";
import { isRootStore } from "mobx-keystone";
import { type PropsWithChildren, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from "vitest";

import {
  type ComponentSpec,
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/appRoutes";
import {
  type RemotePipelineNodeType,
  validateRemotePipelineSearch,
} from "@/routes/remotePipelineSearch";
import { EditorNodeLinkButton } from "@/routes/v2/pages/Editor/components/RemotePipelineNodeLinkButton";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { RemotePipelineView } from "./RemotePipelineView";

let canvas: ReactFlowProps;
let editor: EditorStore;
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useSearch: () => ({}),
}));
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock(
  "@/routes/v2/pages/Editor/components/PipelineDetailsContent/PipelineDetailsContent",
  () => ({ PipelineDetailsContent: () => null }),
);
vi.mock("./RemotePipelineActions", () => ({
  RemotePipelineActions: () => null,
}));
vi.mock("@/routes/v2/pages/Editor/hooks/useAiChatWindow", () => ({
  useAiChatWindow: () => {},
}));
vi.mock("@/routes/v2/shared/components/MiniMap/CanvasControlsContent", () => ({
  CanvasControlsContent: () => <button>Fit view</button>,
}));
vi.mock(
  "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/TaskDetails",
  () => {
    return {
      TaskDetails: ({ entityId }: { entityId: string }) => (
        <EditorNodeLinkButton entityId={entityId} nodeType="task" />
      ),
    };
  },
);
vi.mock("@/routes/v2/pages/Editor/nodes/IONode/context/InputDetails", () => {
  return {
    InputDetails: ({ entityId }: { entityId: string }) => (
      <EditorNodeLinkButton entityId={entityId} nodeType="input" />
    ),
  };
});
vi.mock("@/routes/v2/pages/Editor/nodes/IONode/context/OutputDetails", () => {
  return {
    OutputDetails: ({ entityId }: { entityId: string }) => (
      <EditorNodeLinkButton entityId={entityId} nodeType="output" />
    ),
  };
});
vi.mock("@xyflow/react", async (original) => {
  const { useSharedStores } =
    await import("@/routes/v2/shared/store/SharedStoreContext");
  return {
    ...(await original<typeof import("@xyflow/react")>()),
    ReactFlow: (props: ReactFlowProps) => {
      canvas = props;
      editor = useSharedStores().editor;
      return (
        <>
          {props.nodes?.map((node) => (
            <span key={node.id}>{String(node.data.name ?? "")}</span>
          ))}
          {props.children}
        </>
      );
    },
    Controls: () => <button>Fit view</button>,
    Background: () => null,
    useNodesInitialized: () => false,
  };
});
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => null,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", async () => {
  const { useSharedStores } =
    await import("@/routes/v2/shared/store/SharedStoreContext");
  return {
    SubgraphBreadcrumbs: () => {
      const { navigation } = useSharedStores();
      return (
        <button onClick={() => navigation.navigateToLevel(0)}>Root</button>
      );
    },
  };
});
beforeEach(() => {
  localStorage.clear();
  const observer = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.stubGlobal("ResizeObserver", observer);
  vi.stubGlobal("IntersectionObserver", observer);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function RouterWrapper({ children }: PropsWithChildren) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });
  return (
    <RouterContextProvider router={router}>{children}</RouterContextProvider>
  );
}

it("shows a read-only graph and navigates subgraphs without changing the spec", async () => {
  const child = { name: "Child", implementation: { graph: { tasks: {} } } };
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    implementation: {
      graph: { tasks: { "First task": { componentRef: { spec: child } } } },
    },
  });
  const initialYaml = serializeComponentSpecToText(spec);
  const { unmount } = render(
    <StrictMode>
      <RemotePipelineView spec={spec} />
    </StrictMode>,
    { wrapper: RouterWrapper },
  );
  await screen.findByText("First task");
  expect(screen.getByText("View only")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Fit view" })).toBeInTheDocument();
  expect(canvas).toMatchObject({
    nodesConnectable: false,
    edgesReconnectable: false,
    nodesDraggable: false,
    deleteKeyCode: null,
  });
  expect(canvas.onConnect).toBeUndefined();
  expect(canvas.onDrop).toBeUndefined();
  expect(isRootStore(spec)).toBe(true);
  const node = canvas.nodes![0];
  act(() => canvas.onNodesChange?.([{ type: "remove", id: node.id }]));
  expect(screen.getByText("First task")).toBeInTheDocument();
  act(() => canvas.onNodeDoubleClick?.({} as never, node));
  expect(screen.queryByText("First task")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Root" }));
  await screen.findByText("First task");
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
  unmount();
  expect(isRootStore(spec)).toBe(false);
});

it("copies the selected task only while the view is active", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard",
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  onTestFinished(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    implementation: {
      graph: {
        tasks: {
          "First task": {
            componentRef: {
              spec: { name: "Child", implementation: { graph: { tasks: {} } } },
            },
          },
        },
      },
    },
  });
  const { rerender, unmount } = render(<RemotePipelineView spec={spec} />, {
    wrapper: RouterWrapper,
  });
  await screen.findByText("First task");
  const node = canvas.nodes![0];
  act(() => canvas.onSelectionChange?.({ nodes: [node], edges: [] }));

  fireEvent.keyDown(window, { key: "c", metaKey: true });
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(JSON.parse(writeText.mock.calls[0][0])).toMatchObject({
    _type: "tangle-pipeline-nodes",
    snapshots: [{ $type: "task", entityId: node.id, name: "First task" }],
    bindings: [],
  });

  rerender(<RemotePipelineView spec={spec} isActive={false} />);
  fireEvent.keyDown(window, { key: "c", metaKey: true });
  expect(writeText).toHaveBeenCalledTimes(1);

  rerender(<RemotePipelineView spec={spec} isActive />);
  fireEvent.keyDown(window, { key: "c", metaKey: true });
  expect(writeText).toHaveBeenCalledTimes(2);

  unmount();
  fireEvent.keyDown(window, { key: "c", metaKey: true });
  expect(writeText).toHaveBeenCalledTimes(2);
});

function nestedPipeline() {
  return new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    implementation: {
      graph: {
        tasks: {
          "Nested / graph": {
            componentRef: {
              spec: {
                name: "Nested graph",
                inputs: [{ name: "shared" }],
                outputs: [{ name: "shared" }],
                implementation: {
                  graph: {
                    tasks: {
                      shared: {
                        componentRef: {
                          spec: {
                            name: "Worker",
                            implementation: { container: {} },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

async function openRoutedView(
  spec: ComponentSpec,
  search: string,
  embedded = false,
) {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
    validateSearch: validateRemotePipelineSearch,
    component: () => (
      <RemotePipelineView
        spec={spec}
        pipelineId={embedded ? undefined : "pipeline-id"}
        file={
          embedded
            ? undefined
            : ({
                id: "pipeline-id",
                remote: {
                  pipelineId: "pipeline-id",
                  backendUrl: "https://backend.example.com",
                },
                folder: { driver: { ownerId: "other-user" } },
              } as PipelineFile)
        }
      />
    ),
  });
  const history = createMemoryHistory({
    initialEntries: [`/editor-v2/pipeline/pipeline-id?${search}`],
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history,
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, history };
}

it.each<RemotePipelineNodeType>(["task", "input", "output"])(
  "opens and shares a nested read-only %s and tracks breadcrumb navigation",
  async (nodeType) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    onTestFinished(() => {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    });
    const spec = nestedPipeline();
    const initialYaml = serializeComponentSpecToText(spec);
    const child = spec.tasks[0].subgraphSpec!;
    const node =
      nodeType === "task"
        ? child.tasks[0]
        : nodeType === "input"
          ? child.inputs[0]
          : child.outputs[0];
    const search = new URLSearchParams({
      subgraphPath: JSON.stringify(["Nested / graph"]),
      nodeId: "shared",
      nodeType,
      projectId: "project-1",
    }).toString();
    const { router, history } = await openRoutedView(spec, search);

    await waitFor(() => expect(editor.selectedNodeId).toBe(node.$id));
    expect(editor.selectedNodeType).toBe(nodeType);
    expect(canvas.nodes?.some((item) => item.id === node.$id)).toBe(true);
    expect(screen.getByText("View only")).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.search.nodeId).toBe("shared"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy node link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const link = new URL(writeText.mock.calls[0][0]);
    expect(link.pathname).toBe("/editor-v2/pipeline/pipeline-id");
    expect(link.searchParams.get("nodeId")).toBe("shared");
    expect(link.searchParams.get("nodeType")).toBe(nodeType);
    expect(JSON.parse(link.searchParams.get("subgraphPath")!)).toEqual([
      "Nested / graph",
    ]);
    expect(link.searchParams.get("projectId")).toBe("project-1");

    fireEvent.click(screen.getByRole("button", { name: "Root" }));
    await screen.findByText("Nested / graph");
    await waitFor(() =>
      expect(router.state.location.search.subgraphPath).toBeUndefined(),
    );
    expect(screen.queryByRole("button", { name: "Copy node link" })).toBeNull();
    await act(async () => {
      history.back();
      await router.load();
    });
    await waitFor(() =>
      expect(canvas.nodes?.some((item) => item.id === node.$id)).toBe(true),
    );
    expect(router.state.location.search.subgraphPath).toEqual([
      "Nested / graph",
    ]);
    expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
  },
);

it("keeps an embedded view independent from the enclosing remote pipeline URL", async () => {
  const spec = nestedPipeline();
  const search = new URLSearchParams({
    subgraphPath: JSON.stringify(["Unrelated graph"]),
    nodeId: "Unrelated task",
  }).toString();
  const { router, history } = await openRoutedView(spec, search, true);
  await screen.findByText("Nested / graph");
  const initialLocation = history.location.href;
  const node = canvas.nodes![0];
  act(() => canvas.onNodeDoubleClick?.({} as never, node));
  await waitFor(() =>
    expect(canvas.nodes?.some((item) => item.id === node.id)).toBe(false),
  );
  expect(history.location.href).toBe(initialLocation);
  expect(router.state.location.search.nodeId).toBe("Unrelated task");
  act(() =>
    editor.selectNode(spec.tasks[0].subgraphSpec!.inputs[0].$id, "input"),
  );
  expect(editor.selectedNodeId).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Copy node link" })).toBeNull();
});
