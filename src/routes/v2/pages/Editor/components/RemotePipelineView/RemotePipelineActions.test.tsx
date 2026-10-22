import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { SavedPipelineDocument } from "@/services/pipelineSpecService";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { componentSpecFromYaml } from "@/utils/yaml";

import { RemotePipelineActions } from "./RemotePipelineActions";

let storage: PipelineStorageService;
let navigation: NavigationStore;
let file: PipelineFile;
let queryClient: QueryClient;
const navigate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation, editor: new EditorStore() }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
  }),
}));
vi.mock("@/utils/backendSettings", () => ({
  getBackendSettings: async () => ({}),
  selectBackendUrl: () => "https://backend.example.com",
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/api/client.gen", () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock("@/api/sdk.gen", () => ({ getCurrentUserApiUsersMeGet: vi.fn() }));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({ exportPipeline: vi.fn() }),
);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  localStorage.clear();
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  vi.stubEnv("VITE_REQUIRE_AUTHORIZATION", "false");
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const spec = {
    name: `Shared ${crypto.randomUUID()}`,
    description: "A shared pipeline",
    implementation: {
      graph: {
        tasks: {
          Nested: {
            componentRef: {
              spec: {
                name: "Subgraph",
                implementation: { graph: { tasks: {} } },
              },
            },
          },
        },
      },
    },
  };
  vi.mocked(client.get).mockResolvedValue({
    data: {
      id: "source",
      user_id: "another-user",
      file_path: "shared.yaml",
      root_pipeline_task: { componentRef: { spec } },
      pipeline_run_annotations: { shared: "true" },
    },
    response: new Response(null, { status: 200 }),
  } as never);
  vi.mocked(getCurrentUserApiUsersMeGet).mockResolvedValue({
    data: { id: "current-user", permissions: ["read", "write"] },
    response: new Response(null, { status: 200 }),
  } as never);
  vi.mocked(client.put).mockImplementation(
    async (options) =>
      ({
        data: {
          id: "copy",
          user_id: "current-user",
          file_path: options?.query?.file_path,
          ...(options?.body as object),
        },
        response: new Response(null, { status: 200 }),
      }) as never,
  );
  storage = new PipelineStorageService();
  file = await storage.resolvePipeline({
    source: "remote",
    pipelineId: "source",
    backendUrl: "https://backend.example.com",
  });
  navigation = new NavigationStore(new EditorStore());
  navigation.initNavigation(
    new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
      componentSpecFromYaml(await file.read()),
    ),
  );
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function renderActions() {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });
  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RemotePipelineActions file={file} />
        </ThemeProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

it.each([false, true])(
  "clones the full pipeline from a subgraph with remote storage %s without changing its source",
  async (remote) => {
    vi.stubEnv("VITE_REMOTE_PIPELINES", String(remote));
    const initial = await file.read();
    navigation.navigateToSubgraph(
      navigation.rootSpec!,
      navigation.rootSpec!.tasks[0].$id,
    );
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Clone pipeline" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", {
      name: "Clone pipeline",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    if (remote) {
      expect(client.put).toHaveBeenCalledOnce();
      const options = vi.mocked(client.put).mock.calls[0][0]!;
      expect(options.query?.file_path).not.toBe("shared.yaml");
      const body = options.body as SavedPipelineDocument;
      expect(body.root_pipeline_task.componentRef.spec.name).toBe(
        `${navigation.rootSpec!.name} (Copy)`,
      );
      expect(
        body.root_pipeline_task.componentRef.spec.implementation,
      ).toHaveProperty("graph.tasks.Nested");
      expect(body.pipeline_run_annotations).toEqual({ shared: "true" });
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ params: { pipelineId: "copy" } }),
      );
    } else {
      expect(client.put).not.toHaveBeenCalled();
      const saved = await new PipelineStorageService().resolvePipelineByName(
        `${navigation.rootSpec!.name} (Copy)`,
      );
      expect(componentSpecFromYaml(await saved!.read())).toMatchObject({
        description: "A shared pipeline",
      });
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { fileId: saved!.id } }),
      );
    }
    expect(await file.read()).toBe(initial);
    expect(file.folder.driver.canEdit).toBe(false);
  },
);
