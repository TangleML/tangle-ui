import {
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineSpecApiError } from "@/services/pipelineSpecService";

import Editor from "./Editor/Editor";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";

const route = vi.hoisted(() => ({
  params: {} as Record<string, unknown>,
  search: {} as Record<string, string>,
}));
const backend = vi.hoisted(() => ({
  backendUrl: "https://backend.example.com",
  ready: true,
  configured: true,
}));
const loadLegacy = vi.hoisted(() => vi.fn());
const loadV2 = vi.hoisted(() => vi.fn());
const initializeEditing = vi.hoisted(() => vi.fn());
const pendingSpec = new Promise<never>(() => {});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useParams: () => route.params,
  useSearch: () => route.search,
}));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));
vi.mock("@/services/errorManagement/bugsnag", () => ({ reportError: vi.fn() }));
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => (
    <nav aria-label="Application actions">
      <button>Sign in</button>
    </nav>
  ),
}));
vi.mock("@/routes/router", async () => import("./appRoutes"));
vi.mock("@/hooks/useLoadComponentSpecFromPath", () => ({
  useLoadComponentSpecFromPath: loadLegacy,
}));
vi.mock("@/components/Editor/PipelineEditor", () => ({
  default: () => <div>Legacy pipeline canvas</div>,
}));
vi.mock("@/hooks/useRecentlyViewed", () => ({ addRecentlyViewed: vi.fn() }));
vi.mock("./v2/pages/Editor/hooks/useLoadSpec", () => ({
  useLoadSpec: loadV2,
}));
vi.mock(
  "./v2/pages/Editor/components/RemotePipelineView/RemotePipelineView",
  () => ({
    RemotePipelineView: ({ spec }: { spec: { name: string } }) => (
      <div>{spec.name}</div>
    ),
  }),
);
vi.mock("./v2/pages/Editor/hooks/useSpecLifecycle", () => ({
  useSpecLifecycle: initializeEditing,
}));
vi.mock("./v2/pages/Editor/components/EditorMenuBar/EditorMenuBar", () => ({
  EditorMenuBar: () => <nav aria-label="Editor navigation" />,
}));
vi.mock("./v2/pages/Editor/components/DriverPermissionGate", () => ({
  DriverPermissionGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./v2/pages/Editor/components/EmptyEditorState", () => ({
  EmptyEditorState: () => <div>Open local pipeline</div>,
}));
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
vi.mock("@/routes/v2/shared/components/AiChat/AiChatStoreContext", () => ({
  AiChatStoreProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./v2/pages/Editor/components/AiChat/editorAgentWorker", () => ({
  createEditorAgentWorker: vi.fn(),
}));
vi.mock(
  "./v2/pages/Editor/components/EditorTourBridge/EditorTourBridge",
  () => ({
    EditorTourBridge: () => null,
  }),
);
vi.mock("@/providers/TourProvider/TourSaveExploreDialog", () => ({
  TourSaveExploreDialog: () => null,
}));
vi.mock("@/providers/TourProvider/TourSecretsDialog", () => ({
  TourSecretsDialog: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem("jwtToken");
  route.params = { pipelineName: "pipeline-123" };
  route.search = {};
  backend.ready = true;
  backend.configured = true;
  backend.backendUrl = "https://backend.example.com";
  loadLegacy.mockReturnValue({ componentSpec: null, error: null });
  loadV2.mockImplementation(() => {
    throw pendingSpec;
  });
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("jwtToken");
  vi.restoreAllMocks();
});

function renderEditor(children: ReactNode, basepath = "", hash = false) {
  const history = hash ? createHashHistory() : createMemoryHistory();
  const router = createRouter({
    routeTree: createRootRoute(),
    history,
    basepath,
  });
  return render(
    <RouterContextProvider router={router}>{children}</RouterContextProvider>,
  );
}

describe("remote pipeline editor entry", () => {
  it("keeps the legacy editor from looking up a remote ID locally", () => {
    route.params = { pipelineId: "pipeline-123" };
    renderEditor(<Editor />);

    expect(loadLegacy).not.toHaveBeenCalled();
    expect(screen.queryByText("Loading Pipeline")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Legacy pipeline canvas"),
    ).not.toBeInTheDocument();
  });

  it("continues loading a local pipeline named remote in the legacy editor", () => {
    route.params = { name: "remote" };
    renderEditor(<Editor />);

    expect(loadLegacy).toHaveBeenCalled();
    expect(screen.getByText("Loading Pipeline")).toBeInTheDocument();
  });

  it("loads remote IDs through the backend-scoped V2 storage reference", () => {
    route.params = { pipelineId: "pipeline-123" };
    route.search = { fileId: "local-file-id" };
    renderEditor(<EditorV2 />);

    expect(
      screen.queryByRole("navigation", { name: "Editor navigation" }),
    ).not.toBeInTheDocument();
    expect(loadV2).toHaveBeenCalledWith({
      source: "remote",
      backendUrl: "https://backend.example.com",
      pipelineId: "pipeline-123",
    });
    expect(initializeEditing).not.toHaveBeenCalled();
    expect(screen.queryByText("Open local pipeline")).not.toBeInTheDocument();
  });

  it("shows the loaded remote graph without initializing editor sessions or autosave", () => {
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockReturnValue({ data: { spec: { name: "Remote graph" } } });
    renderEditor(<EditorV2 />);
    expect(screen.getByText("Remote graph")).toBeInTheDocument();
    expect(initializeEditing).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("navigation", { name: "Editor navigation" }),
    ).not.toBeInTheDocument();
  });

  it("waits for backend settings before resolving a remote pipeline", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.ready = false;
    renderEditor(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("explains when a remote pipeline has no configured backend", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    renderEditor(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Configure a backend");
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps settings and Home links inside a deployment base path", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    renderEditor(<EditorV2 />, "/app");
    expect(
      screen.getByRole("link", { name: "Backend settings" }),
    ).toHaveAttribute("href", "/app/settings/backend");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/app/",
    );
  });

  it("keeps settings and Home links inside hash history", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    renderEditor(<EditorV2 />, "", true);
    expect(
      screen
        .getByRole("link", { name: "Backend settings" })
        .getAttribute("href"),
    ).toContain("#/settings/backend");
    expect(
      screen.getByRole("link", { name: "Home" }).getAttribute("href"),
    ).toContain("#/");
  });

  it.each([
    [401, "Sign in to view this pipeline."],
    [403, "You don't have access to this pipeline."],
    [404, "Pipeline not found."],
  ])(
    "keeps navigation available for HTTP %s without offering a futile retry",
    (status, message) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      route.params = { pipelineId: "pipeline-123" };
      loadV2.mockImplementation(() => {
        throw new PipelineSpecApiError("Request failed", status);
      });
      renderEditor(<EditorV2 />);
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to pipelines" }),
      ).toHaveAttribute("href", "/pipelines");
      expect(
        screen.queryByRole("button", { name: "Retry" }),
      ).not.toBeInTheDocument();
      expect(initializeEditing).not.toHaveBeenCalled();
    },
  );

  it.each([
    new TypeError("Failed to fetch"),
    new PipelineSpecApiError("Unavailable", 503),
    new PipelineSpecApiError("Request timed out", 408),
    new PipelineSpecApiError("Too many requests", 429),
  ])("can recover from a transient load error (%s)", (error) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockImplementation(() => {
      throw error;
    });
    renderEditor(<EditorV2 />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    loadV2.mockReturnValue({ data: { spec: { name: "Recovered pipeline" } } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered pipeline")).toBeInTheDocument();
    expect(initializeEditing).not.toHaveBeenCalled();
  });

  it.each([401, 403])("retries an HTTP %s load after signing in", (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockImplementation(() => {
      throw new PipelineSpecApiError("Authentication required", status);
    });
    renderEditor(<EditorV2 />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    loadV2.mockReturnValue({
      data: { spec: { name: "Authenticated pipeline" } },
    });
    localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "signed-in-token" }),
    );
    fireEvent(window, new StorageEvent("storage", { key: "jwtToken" }));

    expect(screen.getByText("Authenticated pipeline")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(initializeEditing).not.toHaveBeenCalled();
  });

  it("recovers after signing out and back in with the same authentication token", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storedAuth = JSON.stringify({ original_token: "session-token" });
    localStorage.setItem("jwtToken", storedAuth);
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockImplementation(() => {
      throw new PipelineSpecApiError("Authentication required", 401);
    });
    renderEditor(<EditorV2 />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    localStorage.removeItem("jwtToken");
    fireEvent(window, new StorageEvent("storage", { key: "jwtToken" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    loadV2.mockReturnValue({
      data: { spec: { name: "Reauthenticated pipeline" } },
    });
    localStorage.setItem("jwtToken", storedAuth);
    fireEvent(window, new StorageEvent("storage", { key: "jwtToken" }));
    expect(screen.getByText("Reauthenticated pipeline")).toBeInTheDocument();
  });

  it.each([undefined, null, 123])(
    "does not request an invalid remote route ID (%s)",
    (pipelineId) => {
      route.params = { pipelineId };
      renderEditor(<EditorV2 />);
      expect(loadV2).not.toHaveBeenCalled();
      expect(screen.getByText("Open local pipeline")).toBeInTheDocument();
    },
  );

  it("continues resolving local names and file IDs in V2", () => {
    route.search = { fileId: "local-file-id" };
    renderEditor(<EditorV2 />);

    expect(loadV2).toHaveBeenCalledWith({
      name: "pipeline-123",
      fileId: "local-file-id",
    });
    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
  });

  it("continues loading a local pipeline named remote in V2", () => {
    route.params = { pipelineName: "remote" };
    renderEditor(<EditorV2 />);

    expect(loadV2).toHaveBeenCalledWith({ name: "remote", fileId: undefined });
  });

  it("honors an explicit pipeline reference even on a remote route", () => {
    route.params = { pipelineId: "pipeline-123" };
    renderEditor(<EditorV2 pipelineRef={{ name: "tour-pipeline" }} />);

    expect(loadV2).toHaveBeenCalledWith({ name: "tour-pipeline" });
  });

  it("honors an explicit empty pipeline reference", () => {
    route.params = { pipelineId: "pipeline-123" };
    renderEditor(<EditorV2 pipelineRef={null} />);

    expect(screen.getByText("Open local pipeline")).toBeInTheDocument();
    expect(loadV2).not.toHaveBeenCalled();
  });
});
