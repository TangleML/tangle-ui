import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext, type PropsWithChildren, useContext } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { AgentContext } from "@/agent/types";
import {
  type ComponentSpec,
  IncrementingIdGenerator,
  ReplayIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { validateRemotePipelineSearch } from "@/routes/remotePipelineSearch";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { FLEX_NODES_ANNOTATION } from "@/utils/annotationKeys";

import { RemotePipelineView } from "./RemotePipelineView";

const { askAgent, agentContext, fetchPipelineRuns } = vi.hoisted(() => ({
  askAgent: vi.fn(),
  agentContext: vi.fn(),
  fetchPipelineRuns: vi.fn(),
}));
vi.mock("@/routes/v2/shared/components/AiChat/agentClient", () => ({
  AgentClient: class {
    constructor(
      _threadId: string,
      _createWorker: () => Worker,
      context: AgentContext,
    ) {
      agentContext(context);
    }
    ask = askAgent;
    terminate() {}
  },
}));
vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: () => ({
    config: {
      apiBase: "https://ai.example.com/v1",
      apiKey: "test-key",
      model: "test-model",
    },
    modelPreferences: { model: "test-model" },
    isConfigured: true,
    isOwnKeyEnabled: true,
    update: vi.fn(),
  }),
}));
vi.mock("@/services/pipelineRunService", () => ({ fetchPipelineRuns }));
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    configured: false,
    available: false,
    backendUrl: "https://backend.example.com",
  }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({}),
}));
vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({ isAuthorized: true }),
}));
vi.mock("@/components/Project/useRunProjectContext", () => ({
  useRunProjectContext: () => ({ projectIds: [] }),
}));
vi.mock("@monaco-editor/react", () => ({
  default: ({
    defaultValue,
    options,
  }: {
    defaultValue: string;
    options: { readOnly: boolean };
  }) => <pre data-read-only={options.readOnly}>{defaultValue}</pre>,
}));
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => null,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: PropsWithChildren) => children,
}));

let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("betaFlags", JSON.stringify({ "ai-assistant": true }));
  askAgent.mockResolvedValue({
    answer: "This pipeline processes its input.",
    threadId: "test-thread",
    componentReferences: {},
  });
  fetchPipelineRuns.mockResolvedValue({ runs: [] });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }));
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("navigates into read-only subgraphs from DOM double-clicks and restores their URLs", async () => {
  const user = userEvent.setup();
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    implementation: {
      graph: {
        tasks: {
          "Nested / graph": {
            componentRef: {
              spec: {
                name: "Nested graph",
                implementation: {
                  graph: {
                    tasks: {
                      Worker: {
                        componentRef: {
                          spec: {
                            implementation: {
                              container: { image: "example/worker" },
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
    },
  });
  const initialYaml = serializeComponentSpecToText(spec);
  const open = async (href: string) => {
    const root = createRootRoute();
    const route = createRoute({
      getParentRoute: () => root,
      path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
      validateSearch: validateRemotePipelineSearch,
      component: () => (
        <RemotePipelineView spec={spec} pipelineId="shared-pipeline" />
      ),
    });
    const history = createMemoryHistory({ initialEntries: [href] });
    const router = createRouter({
      routeTree: root.addChildren([route]),
      history,
    });
    await router.load();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    return { ...view, router, history };
  };
  const { router, history, unmount } = await open(
    "/editor/pipeline/shared-pipeline",
  );

  fireEvent.doubleClick(await screen.findByText("Nested / graph"));
  expect(await screen.findByText("Worker")).toBeInTheDocument();
  const breadcrumbs = screen.getByRole("navigation", { name: "breadcrumb" });
  expect(breadcrumbs).toHaveTextContent("Nested / graph");
  await waitFor(() =>
    expect(router.state.location.search.subgraphPath).toEqual([
      "Nested / graph",
    ]),
  );
  const deepLink = router.state.location.href;

  await user.click(within(breadcrumbs).getByRole("button", { name: "Root" }));
  expect(await screen.findByText("Nested / graph")).toBeInTheDocument();
  await waitFor(() =>
    expect(router.state.location.search.subgraphPath).toBeUndefined(),
  );
  await act(async () => {
    history.back();
    await router.load();
  });
  expect(await screen.findByText("Worker")).toBeInTheDocument();
  expect(router.state.location.href).toBe(deepLink);

  unmount();
  await open(deepLink);
  expect(await screen.findByText("Worker")).toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "breadcrumb" }),
  ).toHaveTextContent("Nested / graph");
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
});

it("reuses the editor docks and rich details while keeping the pipeline and nodes read-only", async () => {
  const user = userEvent.setup();
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    description: "Inspect this shared pipeline",
    inputs: [
      {
        name: "Source",
        type: "String",
        description: "Pipeline source",
        default: "saved source",
      },
    ],
    outputs: [
      { name: "Result", type: "String", description: "Pipeline result" },
    ],
    implementation: {
      graph: {
        tasks: {
          Process: {
            arguments: { message: "Read only task argument" },
            componentRef: {
              spec: {
                name: "Processor",
                inputs: [{ name: "message", type: "String" }],
                implementation: { container: { image: "example/processor" } },
              },
            },
          },
        },
      },
    },
  });
  spec.annotations.set(FLEX_NODES_ANNOTATION, [
    {
      id: "flex_note",
      properties: {
        title: "Review note",
        content: "Check the pipeline output.",
        color: "#FFF9C4",
      },
      metadata: { createdAt: "2026-01-01T00:00:00Z", createdBy: "example" },
      size: { width: 200, height: 120 },
      position: { x: 0, y: 300 },
      zIndex: 0,
    },
  ]);
  const initialYaml = serializeComponentSpecToText(spec);
  const ViewContext = createContext<{
    spec: ComponentSpec;
    file: PipelineFile;
  } | null>(null);
  const router = createRouter({
    routeTree: createRootRoute({
      component: function PipelineRoute() {
        const props = useContext(ViewContext);
        return props && <RemotePipelineView {...props} />;
      },
    }),
    history: createMemoryHistory(),
  });
  await router.load();
  const sourceFile = {
    id: "shared-pipeline",
    remote: {
      pipelineId: "shared-pipeline",
      backendUrl: "https://first.example.com",
    },
    folder: { driver: { ownerId: "owner@example.com" } },
  } as PipelineFile;
  const view = (pipeline: ComponentSpec, file: PipelineFile) => (
    <ViewContext value={{ spec: pipeline, file }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </ViewContext>
  );
  const { container, rerender } = render(view(spec, sourceFile));

  await waitFor(() => {
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(4);
  });
  expect(screen.getByText("Process")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Result")).toBeInTheDocument();
  const note = container.querySelector(".react-flow__node-flex");
  expect(note).toBeInstanceOf(HTMLElement);
  if (!(note instanceof HTMLElement)) throw new Error("Note did not mount");
  expect(
    within(note).getByText("Check the pipeline output."),
  ).toBeInTheDocument();
  expect(within(note).queryByRole("button")).not.toBeInTheDocument();

  const leftDock = container.querySelector('[data-dock-area="left"]');
  const rightDock = container.querySelector('[data-dock-area="right"]');
  if (
    !(leftDock instanceof HTMLElement) ||
    !(rightDock instanceof HTMLElement)
  ) {
    throw new Error("Pipeline editor docks did not mount");
  }
  expect(within(leftDock).getByText("Pipeline Tools")).toBeInTheDocument();
  for (const name of ["View YAML", "Clone pipeline"]) {
    expect(within(leftDock).getByRole("button", { name })).toBeInTheDocument();
  }
  expect(screen.queryByRole("button", { name: /Submit Run/i })).toBeNull();
  expect(within(leftDock).getByText("Sidekick")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Windows" }));
  expect(
    screen.queryByRole("menuitemcheckbox", { name: "Pipeline Structure" }),
  ).toBeNull();
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Sidekick" }),
  ).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(
    within(screen.getByRole("banner")).queryByRole("button", {
      name: /^(Details|Clone pipeline|Submit Run)$/,
    }),
  ).not.toBeInTheDocument();

  await user.type(
    within(leftDock).getByPlaceholderText("Ask about your pipeline..."),
    "Explain this pipeline",
  );
  await user.click(
    within(leftDock).getByRole("button", { name: "Send message" }),
  );
  await waitFor(() => expect(askAgent).toHaveBeenCalledOnce());
  expect(agentContext).toHaveBeenCalledWith({ mode: "editor", readOnly: true });
  const bridge = askAgent.mock.calls[0][0].bridge as ToolBridgeApi;
  await expect(bridge.getPipelineState()).resolves.toMatchObject({
    name: "Remote pipeline",
  });
  await expect(
    bridge.setPipelineDescription("Should not be saved"),
  ).resolves.toMatchObject({ success: false });
  await expect(bridge.deleteTask(spec.tasks[0].$id)).resolves.toMatchObject({
    success: false,
  });
  await expect(bridge.submitPipelineRun()).resolves.toMatchObject({
    success: false,
  });
  expect(fetchPipelineRuns).not.toHaveBeenCalled();
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);

  const details = await screen.findByTestId("pipeline-details-content");
  expect(rightDock).toContainElement(details);
  expect(within(details).getByText("owner@example.com")).toBeVisible();
  await user.click(
    within(details).getByRole("button", { name: "Metadata & annotations" }),
  );
  expect(details).toHaveTextContent("owner@example.com");
  expect(within(details).getByRole("button", { name: "Inputs" })).toBeEnabled();
  expect(
    within(details).getByRole("button", { name: "Outputs" }),
  ).toBeEnabled();
  const description = within(details).getByTestId("pipeline-description-input");
  expect(description).toHaveValue("Inspect this shared pipeline");
  for (const field of within(details).getAllByRole("textbox")) {
    expect(field).toHaveAttribute("readonly");
    await user.type(field, "changed");
    fireEvent.blur(field);
  }
  expect(within(details).queryByRole("button", { name: "Fix" })).toBeNull();
  expect(details.querySelector("pre")).toBeNull();

  const taskNode = container.querySelector(`[data-id="${spec.tasks[0].$id}"]`);
  if (!taskNode) throw new Error("Task node did not mount");
  fireEvent.click(taskNode);
  const properties = () => {
    const content = rightDock.querySelector(
      '[data-dock-window-content="context-panel"]',
    );
    if (!(content instanceof HTMLElement))
      throw new Error("Properties did not mount");
    return content;
  };
  await waitFor(() => {
    expect(
      within(properties()).getByRole("tab", { name: "Arguments" }),
    ).toBeInTheDocument();
  });
  expect(properties()).toHaveTextContent("Read only task argument");
  expect(
    within(properties()).queryByRole("button", {
      name: /Delete|Duplicate|Unpack/,
    }),
  ).toBeNull();
  await user.click(within(properties()).getByRole("tab", { name: "Config" }));
  expect(properties()).toHaveTextContent("General configuration");
  for (const control of within(properties()).getAllByRole("switch")) {
    expect(control).toBeDisabled();
    await user.click(control);
  }

  for (const entity of [spec.inputs[0], spec.outputs[0]]) {
    const node = container.querySelector(`[data-id="${entity.$id}"]`);
    if (!node) throw new Error(`${entity.name} node did not mount`);
    fireEvent.click(node);
    const name = within(properties()).getByRole("textbox", { name: /^Name/ });
    expect(name).toHaveValue(entity.name);
    for (const field of within(properties()).getAllByRole("textbox")) {
      expect(field).toHaveAttribute("readonly");
      await user.type(field, "changed");
      fireEvent.blur(field);
    }
  }

  fireEvent.doubleClick(within(note).getByText("Review note"));
  fireEvent.doubleClick(within(note).getByText("Check the pipeline output."));
  expect(container.querySelector(".react-flow__resize-control")).toBeNull();
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);

  await user.click(screen.getByText("Pipeline Details"));
  const nextSpec = new YamlDeserializer(
    new ReplayIdGenerator([spec.$id]),
  ).deserialize({
    name: "Other shared pipeline",
    description: "The pipeline on the other backend",
    implementation: { graph: { tasks: {} } },
  });
  expect(nextSpec.$id).toBe(spec.$id);
  rerender(
    view(nextSpec, {
      ...sourceFile,
      remote: {
        ...sourceFile.remote!,
        backendUrl: "https://second.example.com",
      },
      folder: { driver: { ownerId: "second-owner@example.com" } },
    } as PipelineFile),
  );
  const nextDetails = await screen.findByTestId("pipeline-details-content");
  await expect(bridge.getPipelineState()).rejects.toThrow(/changed|aborted/i);
  expect(
    within(nextDetails).getByTestId("pipeline-description-input"),
  ).toHaveValue("The pipeline on the other backend");
  await user.click(
    within(nextDetails).getByRole("button", { name: "Metadata & annotations" }),
  );
  expect(nextDetails).toHaveTextContent("second-owner@example.com");
  expect(
    within(nextDetails).queryByText("owner@example.com", { exact: true }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Clone pipeline" }));
  expect(
    within(await screen.findByRole("dialog")).getByRole("textbox"),
  ).toHaveValue("Other shared pipeline (Copy)");
});
