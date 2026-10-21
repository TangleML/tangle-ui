import {
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineSpecApiError } from "@/services/pipelineSpecService";

import Editor from "./Editor/Editor";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";
import { EmbeddedPipelineEditor } from "./v2/pages/Editor/EmbeddedPipelineEditor";

const route = vi.hoisted(() => ({
  params: {} as Record<string, unknown>,
  search: {} as Record<string, string>,
  context: {} as { newPipeline?: { name: string; draftId: string } },
}));
const permission = vi.hoisted(() => ({ granted: true }));
const backend = vi.hoisted(() => ({
  backendUrl: "https://backend.example.com",
  ready: true,
  configured: true,
}));
const loadLegacy = vi.hoisted(() => vi.fn());
const loadV2 = vi.hoisted(() => vi.fn());
const initializeEditing = vi.hoisted(() => vi.fn());
const mountEditor = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const migrateLocal = vi.hoisted(() => vi.fn());
const pendingSpec = new Promise<never>(() => {});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...original,
    useParams: () => route.params,
    useSearch: () => route.search,
    useNavigate: () => navigate,
    useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
      original.useRouterState({
        select: (state) =>
          select({
            ...state,
            matches: [
              ...state.matches.slice(0, -1),
              {
                ...state.matches.at(-1),
                params: route.params,
                search: route.search,
                context: route.context,
              },
            ],
          }),
      }),
  };
});
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
vi.mock("@/components/shared/LocalPipelineMigration", () => ({
  LocalPipelineMigration: migrateLocal,
}));
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
  DriverPermissionGate: ({ children }: { children: ReactNode }) =>
    permission.granted ? children : <div>Grant Access</div>,
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
    permission.granted ? children : null,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreRegistrar", () => ({
  SharedStoreRegistrar: () => {
    useState(() => mountEditor());
    return null;
  },
}));
vi.mock("@/routes/v2/shared/components/AiChat/AiChatStoreContext", () => ({
  useAiChatStore: () => ({ threads: [] }),
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
  route.context = {};
  permission.granted = true;
  backend.ready = true;
  backend.configured = true;
  backend.backendUrl = "https://backend.example.com";
  loadLegacy.mockReturnValue({ componentSpec: null, error: null });
  migrateLocal.mockImplementation(
    ({ children }: { children: ReactNode }) => children,
  );
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
  return render(children, {
    wrapper: ({ children }) => (
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    ),
  });
}

describe("remote pipeline editor entry", () => {
  it("keeps the mounted editor session when a workarea draft becomes remote", () => {
    permission.granted = false;
    loadV2.mockReturnValue({
      data: {
        spec: { name: "Draft" },
        file: { folder: { driver: { canEdit: true } } },
      },
    });
    const opened = renderEditor(
      <EmbeddedPipelineEditor
        pipelineRef={{
          source: "draft",
          backendUrl: backend.backendUrl,
          draftId: "draft-1",
          name: "Draft",
        }}
        isActive
        projectId="project-1"
      />,
    );
    expect(mountEditor).toHaveBeenCalledOnce();
    opened.rerender(
      <EmbeddedPipelineEditor
        pipelineRef={{
          source: "remote",
          backendUrl: backend.backendUrl,
          pipelineId: "remote-1",
        }}
        isActive
        projectId="project-1"
      />,
    );
    expect(mountEditor).toHaveBeenCalledOnce();
  });
  it("requests local file permission before reading an embedded pipeline", () => {
    permission.granted = false;
    renderEditor(
      <EmbeddedPipelineEditor
        pipelineRef={{ name: "Local pipeline", fileId: "local-1" }}
        isActive
        projectId="project-1"
      />,
    );
    expect(screen.getByText("Grant Access")).toBeInTheDocument();
    expect(loadV2).not.toHaveBeenCalled();
  });
  it("keeps remote project pipelines read-only without starting editing tools", () => {
    loadV2.mockReturnValue({
      data: {
        spec: { name: "Shared project graph" },
        file: { folder: { driver: { canEdit: false } } },
      },
    });
    renderEditor(
      <EmbeddedPipelineEditor
        pipelineRef={{
          source: "remote",
          backendUrl: backend.backendUrl,
          pipelineId: "shared-1",
        }}
        isActive
        projectId="project-1"
      />,
    );
    expect(screen.getByText("Shared project graph")).toBeInTheDocument();
    expect(initializeEditing).not.toHaveBeenCalled();
  });
  it("requires a configured backend to open a remote draft", () => {
    route.context = {
      newPipeline: {
        name: "pipeline-123",
        draftId: "12345678-1234-4234-8234-123456789abc",
      },
    };
    backend.configured = false;
    renderEditor(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Configure a backend");
  });
  it("redirects legacy remote URLs to the V2 editor", () => {
    route.params = { pipelineId: "pipeline-123" };
    route.search = { projectId: "project-1" };
    renderEditor(<Editor />);

    expect(loadLegacy).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/editor-v2/pipeline/$pipelineId",
      params: { pipelineId: "pipeline-123" },
      search: { projectId: "project-1" },
      replace: true,
    });
  });

  it.each(["legacy", "V2"])(
    "waits for %s local migration before loading and preserves the project",
    (editor) => {
      const View = editor === "legacy" ? Editor : EditorV2;
      route.params =
        editor === "legacy"
          ? { name: "Local pipeline" }
          : { pipelineName: "Local pipeline" };
      route.search = { fileId: "local-1", projectId: "project-1" };
      migrateLocal.mockImplementation(
        ({ onMigrated }: { onMigrated: (file: { id: string }) => void }) => (
          <button onClick={() => onMigrated({ id: "remote-1" })}>
            Finish migration
          </button>
        ),
      );
      renderEditor(<View />);
      expect(loadLegacy).not.toHaveBeenCalled();
      expect(migrateLocal.mock.calls[0][0]).toMatchObject({
        pipelineRef: { name: "Local pipeline", fileId: "local-1" },
        projectId: "project-1",
      });
      fireEvent.click(screen.getByRole("button", { name: "Finish migration" }));
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/editor-v2/pipeline/$pipelineId",
          params: { pipelineId: "remote-1" },
          search: { projectId: "project-1" },
          replace: true,
        }),
      );
    },
  );

  it.each(["legacy", "V2"])(
    "clears inaccessible project context after %s migration",
    (editor) => {
      const View = editor === "legacy" ? Editor : EditorV2;
      route.params =
        editor === "legacy"
          ? { name: "Local pipeline" }
          : { pipelineName: "Local pipeline" };
      route.search = { fileId: "local-1", projectId: "removed-project" };
      migrateLocal.mockImplementation(
        ({
          onMigrated,
        }: {
          onMigrated: (
            file: { id: string },
            clearProjectContext?: boolean,
          ) => void;
        }) => (
          <button onClick={() => onMigrated({ id: "remote-1" }, true)}>
            Finish migration
          </button>
        ),
      );
      renderEditor(<View />);
      fireEvent.click(screen.getByRole("button", { name: "Finish migration" }));
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { pipelineId: "remote-1" },
          search: { projectId: undefined },
        }),
      );
    },
  );

  it("requests legacy local file permission before migration", () => {
    route.params = { name: "Local pipeline" };
    permission.granted = false;
    renderEditor(<Editor />);
    expect(screen.getByText("Grant Access")).toBeInTheDocument();
    expect(migrateLocal).not.toHaveBeenCalled();
    expect(loadLegacy).not.toHaveBeenCalled();
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

  it.each([false, undefined])(
    "preserves viewing without an editing session when write access is %s",
    (canEdit) => {
      route.params = { pipelineId: "pipeline-123" };
      loadV2.mockReturnValue({
        data: {
          spec: { name: "Remote graph" },
          file: { folder: { driver: { canEdit } } },
        },
      });
      renderEditor(<EditorV2 />);
      expect(screen.getByText("Remote graph")).toBeInTheDocument();
      expect(initializeEditing).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("navigation", { name: "Editor navigation" }),
      ).not.toBeInTheDocument();
    },
  );

  it("opens the editor after the remote driver verifies write access", () => {
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockReturnValueOnce({
      data: {
        spec: { name: "Remote graph" },
        file: { folder: { driver: { canEdit: true } } },
      },
    });
    renderEditor(<EditorV2 />);
    expect(
      screen.getByRole("navigation", { name: "Editor navigation" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Remote graph")).not.toBeInTheDocument();
    expect(loadV2).toHaveBeenCalledWith({
      source: "remote",
      backendUrl: backend.backendUrl,
      pipelineId: "pipeline-123",
    });
  });

  it("shows failed remote reads without entering the editor", () => {
    route.params = { pipelineId: "pipeline-123" };
    loadV2.mockImplementation(() => {
      throw new Error("Pipeline not found");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      renderEditor(<EditorV2 />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to load pipeline. Please try again.",
      );
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(initializeEditing).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("navigation", { name: "Editor navigation" }),
      ).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("clears a failed read when navigating to another remote pipeline", () => {
    route.params = { pipelineId: "missing" };
    loadV2.mockImplementation(() => {
      throw new Error("Pipeline not found");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const { rerender } = renderEditor(<EditorV2 />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to load pipeline. Please try again.",
      );
      route.params = { pipelineId: "available" };
      loadV2.mockReturnValue({
        data: {
          spec: { name: "Available pipeline" },
          file: { folder: { driver: { canEdit: false } } },
        },
      });
      rerender(<EditorV2 />);
      expect(screen.getByText("Available pipeline")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
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
    [401, "Sign in, then retry to view this pipeline.", true],
    [
      403,
      "You don't have access to this pipeline. Check your sign-in, then retry.",
      true,
    ],
    [404, "Pipeline not found.", false],
    [422, "Pipeline not found.", false],
  ])(
    "keeps navigation and appropriate recovery available for HTTP %s",
    (status, message, retryable) => {
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
      expect(Boolean(screen.queryByRole("button", { name: "Retry" }))).toBe(
        retryable,
      );
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
    loadV2.mockReturnValue({
      data: {
        spec: { name: "Recovered pipeline" },
        file: { folder: { driver: { canEdit: false } } },
      },
    });
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
      data: {
        spec: { name: "Authenticated pipeline" },
        file: { folder: { driver: { canEdit: false } } },
      },
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
      data: {
        spec: { name: "Reauthenticated pipeline" },
        file: { folder: { driver: { canEdit: false } } },
      },
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
