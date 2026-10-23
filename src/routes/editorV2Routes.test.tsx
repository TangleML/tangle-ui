import "fake-indexeddb/auto";

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
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { defaultPipelineYamlWithName } from "@/utils/constants";

import { APP_ROUTES } from "./appRoutes";
import { createEditorV2Routes } from "./editorV2Routes";
import { EmbeddedPipelineEditor } from "./v2/pages/Editor/EmbeddedPipelineEditor";
import type { useEditorSession } from "./v2/pages/Editor/store/EditorSessionContext";
import type { SharedUIStore } from "./v2/shared/store/SharedStoreContext";

const canvas = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
const flags = vi.hoisted(() => ({ v2Editor: true }));
const chat = vi.hoisted(() => ({ mounts: 0, threads: [{ abort: vi.fn() }] }));
let session: ReturnType<typeof useEditorSession>;
let stores: SharedUIStore;
const storage = new PipelineStorageService();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const pipelineId = "remote-id";

vi.mock("@/routes/router", async () => import("./appRoutes"));
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => (
    <nav aria-label="Application actions">
      <button>Sign in</button>
    </nav>
  ),
}));
vi.mock("@/api/client.gen", () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: async () => [],
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    ready: true,
    configured: true,
  }),
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => false,
  isFlagEnabled: () => flags.v2Editor,
}));
vi.mock("@/services/pipelineStorage/createDriver", () => ({
  createDriver: () => ({}),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("./v2/pages/Editor/store/clipboardStore", () => ({
  ClipboardStore: class {},
}));
vi.mock("./v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock(
  "./v2/pages/Editor/utils/undoHistoryStorage",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("./v2/pages/Editor/utils/undoHistoryStorage")
    >()),
    saveIdStack: vi.fn().mockResolvedValue(undefined),
    saveUndoHistory: vi.fn().mockResolvedValue(undefined),
  }),
);
vi.mock("./v2/pages/Editor/components/FlowCanvas/FlowCanvas", async () => {
  const { useEffect } = await import("react");
  const { useEditorSession } =
    await import("./v2/pages/Editor/store/EditorSessionContext");
  const { useSharedStores } =
    await import("./v2/shared/store/SharedStoreContext");
  return {
    FlowCanvas: function Canvas({
      spec,
    }: {
      spec: import("@/models/componentSpec").ComponentSpec;
    }) {
      session = useEditorSession();
      stores = useSharedStores();
      useEffect(() => {
        canvas.mounts++;
        return () => {
          canvas.unmounts++;
        };
      }, []);
      return (
        <>
          <input aria-label="Canvas state" defaultValue="initial" />
          <button onClick={() => spec.setDescription("First edit")}>
            Edit pipeline
          </button>
        </>
      );
    },
  };
});
vi.mock("./v2/pages/Editor/components/EditorMenuBar/EditorMenuBar", () => ({
  EditorMenuBar: () => null,
}));
vi.mock(
  "./v2/pages/Editor/components/RemotePipelineView/RemotePipelineView",
  () => ({
    RemotePipelineView: () => null,
  }),
);
vi.mock(
  "./v2/pages/Editor/components/EditorTourBridge/EditorTourBridge",
  () => ({ EditorTourBridge: () => null }),
);
vi.mock("./v2/pages/Editor/components/AiChat/editorAgentWorker", () => ({
  createEditorAgentWorker: vi.fn(),
}));
vi.mock("./v2/shared/windows/DockArea", () => ({ DockArea: () => null }));
vi.mock("./v2/shared/windows/WindowContainer", () => ({
  WindowContainer: () => null,
}));
vi.mock("./v2/shared/components/AiChat/AiChatStoreContext", async () => {
  const { useEffect } = await import("react");
  return {
    useAiChatStore: () => chat,
    AiChatStoreProvider: function Provider({
      children,
    }: {
      children: ReactNode;
    }) {
      useEffect(() => {
        chat.mounts++;
      }, []);
      return children;
    },
  };
});
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/providers/ComponentLibraryProvider/ForcedSearchProvider", () => ({
  ForcedSearchProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/shared/ComponentEditor/ComponentEditorProvider", () => ({
  ComponentEditorProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./v2/pages/Editor/components/QuickRunSubmitterContext", () => ({
  QuickRunSubmitterProvider: ({ children }: { children: ReactNode }) =>
    children,
}));
vi.mock("@/providers/TourProvider/TourModeContext", () => ({
  useTourMode: () => null,
}));
vi.mock("@/providers/TourProvider/TourSaveExploreDialog", () => ({
  TourSaveExploreDialog: () => null,
}));
vi.mock("@/providers/TourProvider/TourSecretsDialog", () => ({
  TourSecretsDialog: () => null,
}));
vi.mock("./v2/pages/Editor/hooks/useAiChatWindow", () => ({
  useAiChatWindow: () => {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  canvas.mounts = 0;
  chat.mounts = 0;
  canvas.unmounts = 0;
  flags.v2Editor = true;
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue({
    data: { id: "user", permissions: ["read", "write"] },
    response: new Response(null, { status: 200 }),
  } as Awaited<ReturnType<typeof getCurrentUserApiUsersMeGet>>);
  let filePath = "";
  vi.mocked(client.put).mockImplementation(async (options) => {
    filePath = String(options?.query?.file_path ?? filePath);
    return {
      data: {
        id: pipelineId,
        user_id: "user",
        file_path: filePath,
        ...(options?.body as object),
      },
      response: new Response(null, { status: 200 }),
    } as Awaited<ReturnType<typeof client.put>>;
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function open(initialEntry: string = APP_ROUTES.EDITOR_NEW_PIPELINE) {
  const root = createRootRoute();
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: APP_ROUTES.DASHBOARD_PIPELINES,
    component: () => <p>Dashboard</p>,
  });
  const history = createMemoryHistory({
    initialEntries: [APP_ROUTES.DASHBOARD_PIPELINES, initialEntry],
  });
  const router = createRouter({
    routeTree: root.addChildren([createEditorV2Routes(root), dashboard]),
    history,
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Edit pipeline" });
  return { router, history };
}

it.each([true, false])(
  "reports the loaded embedded pipeline name (editable: %s)",
  async (editable) => {
    const onTitleChange = vi.fn();
    vi.mocked(client.get).mockResolvedValue({
      data: {
        id: pipelineId,
        user_id: editable ? "user" : "other-user",
        file_path: "pipelines/embedded.yaml",
        pipeline_run_annotations: {},
        root_pipeline_task: {
          componentRef: {
            spec: {
              name: "Actual pipeline name",
              implementation: { graph: { tasks: {} } },
            },
          },
        },
      },
      response: new Response(null, { status: 200 }),
    } as Awaited<ReturnType<typeof client.get>>);
    const route = createRootRoute({
      component: () => (
        <DialogProvider>
          <EmbeddedPipelineEditor
            pipelineRef={{
              source: "remote",
              pipelineId,
              backendUrl: "https://backend.example.com",
            }}
            projectId="project-1"
            isActive
            onTitleChange={onTitleChange}
          />
        </DialogProvider>
      ),
    });
    const router = createRouter({
      routeTree: route,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(onTitleChange).toHaveBeenCalledWith("Actual pipeline name"),
    );
    expect(client.get).toHaveBeenCalledOnce();
  },
);

it("replaces the draft URL without remounting the canvas or editor session", async () => {
  const { router, history } = await open();
  await act(async () => session.autoSave.save());
  expect(client.put).not.toHaveBeenCalled();
  const input = screen.getByRole("textbox", { name: "Canvas state" });
  fireEvent.change(input, { target: { value: "Keep viewport and selection" } });
  const previousSession = session;
  const previousManager = session.undo.undoManager;
  const spec = session.pipelineFile.activePipelineFile;
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() =>
    expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`),
  );
  expect(history.location.search).toBe("");
  expect(screen.getByRole("textbox", { name: "Canvas state" })).toBe(input);
  expect(input).toHaveValue("Keep viewport and selection");
  expect(canvas.mounts).toBe(1);
  expect(canvas.unmounts).toBe(0);
  expect(session).toBe(previousSession);
  expect(session.pipelineFile.activePipelineFile).toBe(spec);
  expect(session.undo.undoManager).toBe(previousManager);
  expect(session.undo.canUndo).toBe(true);
  expect(client.put).toHaveBeenCalledOnce();
  expect(client.get).not.toHaveBeenCalled();
  act(() => session.undo.undo());
  await waitFor(() => expect(client.put).toHaveBeenCalledTimes(2));
  await act(async () => {
    history.back();
    await router.load();
  });
  await screen.findByText("Dashboard");
});

it("retains a failed draft edit and changes its URL only after retry succeeds", async () => {
  const { history } = await open();
  vi.mocked(client.put).mockRejectedValueOnce(new Error("Backend unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() =>
    expect(session.autoSave.error).toBe("Backend unavailable"),
  );
  expect(history.location.pathname).toBe(APP_ROUTES.EDITOR_NEW_PIPELINE);
  expect(history.location.search).toBe("");
  expect(session.pipelineFile.activePipelineFile?.isDraft).toBe(true);
  await act(async () => session.autoSave.save());
  await waitFor(() =>
    expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`),
  );
  expect(client.put).toHaveBeenCalledTimes(2);
  expect(canvas.mounts).toBe(1);
});

it("retains a failed draft when browser storage is enabled before returning to it", async () => {
  const { router, history } = await open();
  vi.mocked(client.put).mockRejectedValue(new Error("Backend unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() =>
    expect(session.autoSave.error).toBe("Backend unavailable"),
  );
  const originalFile = session.pipelineFile.activePipelineFile;
  const originalSpec = stores.navigation.rootSpec;
  expect(history.location.state.newPipeline?.storage).toBe("remote");
  await act(async () => {
    history.back();
    await router.load();
  });
  await screen.findByText("Dashboard");
  localStorage.setItem("pipelines:save-in-browser", "true");
  await act(async () => {
    history.forward();
    await router.load();
  });
  await screen.findByRole("button", { name: "Edit pipeline" });
  expect(history.location.pathname).toBe(APP_ROUTES.EDITOR_NEW_PIPELINE);
  expect(session.pipelineFile.activePipelineFile).toBe(originalFile);
  expect(stores.navigation.rootSpec).toBe(originalSpec);
  expect(stores.navigation.rootSpec?.description).toBe("First edit");
  expect(session.autoSave.hasUnsavedChanges).toBe(true);
});

it("starts a separate unsaved pipeline when New is used again at the same URL", async () => {
  const { router, history } = await open();
  const firstFile = session.pipelineFile.activePipelineFile;
  await act(async () => {
    await router.navigate({
      to: APP_ROUTES.EDITOR_NEW_PIPELINE,
      state: {
        newPipeline: { name: "Another pipeline", draftId: crypto.randomUUID() },
      },
    });
  });
  await waitFor(() => {
    expect(session.pipelineFile.activePipelineFile).not.toBe(firstFile);
    expect(session.pipelineFile.activePipelineFile?.storageKey).toBe(
      "Another pipeline",
    );
  });
  expect(history.location.pathname).toBe(APP_ROUTES.EDITOR_NEW_PIPELINE);
  expect(history.location.search).toBe("");
  expect(client.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() =>
    expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`),
  );
  expect(client.put).toHaveBeenCalledOnce();
});

it("opens remote pipelines when the V2 editor flag is disabled", async () => {
  flags.v2Editor = false;
  vi.mocked(client.get).mockResolvedValue({
    data: {
      id: pipelineId,
      user_id: "user",
      file_path: "pipelines/remote.yaml",
      root_pipeline_task: {
        componentRef: {
          spec: {
            name: "Remote pipeline",
            implementation: { graph: { tasks: {} } },
          },
        },
      },
      pipeline_run_annotations: {},
    },
    response: new Response(null, { status: 200 }),
  } as Awaited<ReturnType<typeof client.get>>);
  const { history } = await open(`/editor/pipeline/${pipelineId}`);
  expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`);
  expect(client.get).toHaveBeenCalledOnce();
});
it("reopens the saved pipeline after leaving during creation and going Back", async () => {
  const { router, history } = await open();
  const draftId = history.location.state.newPipeline?.draftId;
  expect(draftId).toMatch(/^[0-9a-f-]{36}$/);
  const put = vi.mocked(client.put).getMockImplementation()!;
  let finish = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.mocked(client.put).mockImplementation(async (...args) => {
    await pending;
    const saved = await put(...args);
    vi.mocked(client.get).mockResolvedValue(saved);
    return saved;
  });
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() => expect(client.put).toHaveBeenCalledOnce());
  await act(async () => {
    await router.navigate({ to: APP_ROUTES.DASHBOARD_PIPELINES });
  });
  await screen.findByText("Dashboard");
  await act(async () => {
    finish();
    await pending;
  });
  await waitFor(() =>
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ["editor-v2-spec"] }),
    ).toHaveLength(0),
  );
  await act(async () => {
    history.back();
    await router.load();
  });
  await screen.findByRole("button", { name: "Edit pipeline" });
  await waitFor(() =>
    expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`),
  );
  expect(session.pipelineFile.activePipelineFile?.remote?.pipelineId).toBe(
    pipelineId,
  );
  expect(client.put).toHaveBeenCalledOnce();
  expect(client.get).toHaveBeenCalledOnce();
});

it("keeps local chat mounted while replacing document undo and save state", async () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
  const first = new PipelineFile({
    id: "local-first",
    storageKey: "First",
    folder: storage.rootFolder,
  });
  const second = new PipelineFile({
    id: "local-second",
    storageKey: "Second",
    folder: storage.rootFolder,
  });
  vi.spyOn(first, "read").mockResolvedValue(
    defaultPipelineYamlWithName("First"),
  );
  vi.spyOn(second, "read").mockResolvedValue(
    defaultPipelineYamlWithName("Second"),
  );
  const writeFirst = vi.spyOn(first, "write").mockResolvedValue();
  const writeSecond = vi.spyOn(second, "write").mockResolvedValue();
  vi.spyOn(storage, "resolvePipelineByName").mockImplementation(async (name) =>
    name === "First" ? first : second,
  );
  const { router } = await open("/editor/First");
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  expect(session.undo.canUndo).toBe(true);
  await act(async () => {
    await router.navigate({
      to: APP_ROUTES.PIPELINE_EDITOR,
      params: { pipelineName: "Second" },
    });
  });
  await waitFor(() =>
    expect(session.pipelineFile.activePipelineFile).toBe(second),
  );
  expect(session.undo.canUndo).toBe(false);
  expect(session.autoSave.hasUnsavedChanges).toBe(false);
  expect(session.autoSave.lastSavedAt).toBeNull();
  expect(writeFirst).toHaveBeenCalledOnce();
  expect(writeSecond).not.toHaveBeenCalled();
  expect(chat.mounts).toBe(1);
  expect(chat.threads[0].abort).toHaveBeenCalled();
});

it("creates and promotes a new pipeline when the V2 flag is disabled", async () => {
  flags.v2Editor = false;
  const { history } = await open();
  fireEvent.click(screen.getByRole("button", { name: "Edit pipeline" }));
  await waitFor(() =>
    expect(history.location.pathname).toBe(`/editor/pipeline/${pipelineId}`),
  );
  expect(client.put).toHaveBeenCalledOnce();
});
