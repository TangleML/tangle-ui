import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { PipelineStorageProvider } from "@/services/pipelineStorage/PipelineStorageProvider";
import { RemotePipelineDeletionError } from "@/services/pipelineStorage/remotePipelineDeletion";

import { Editor } from "./v2/pages/Editor/Editor";
import { EmbeddedPipelineEditor } from "./v2/pages/Editor/EmbeddedPipelineEditor";

const route = vi.hoisted(() => ({
  params: {} as Record<string, unknown>,
  search: {} as Record<string, unknown>,
  context: {} as { newPipeline?: { name: string; draftId: string } },
}));
const permission = vi.hoisted(() => ({ granted: true }));
const backend = vi.hoisted(() => ({
  backendUrl: "https://backend.example.com",
  ready: true,
  configured: true,
}));
const loadSpec = vi.hoisted(() => vi.fn());
const initializeEditing = vi.hoisted(() => vi.fn());
const mountEditor = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const pendingSpec = new Promise<never>(() => {});
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
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
vi.mock("./v2/pages/Editor/hooks/useLoadSpec", () => ({
  useLoadSpec: loadSpec,
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
vi.mock("./v2/pages/Editor/components/EmptyEditorState", () => ({
  EmptyEditorState: () => <div>Open pipeline</div>,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: { children: ReactNode }) => children,
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
  route.params = { pipelineId: "pipeline-123" };
  route.search = {};
  route.context = {};
  permission.granted = true;
  backend.ready = true;
  backend.configured = true;
  backend.backendUrl = "https://backend.example.com";
  loadSpec.mockImplementation(() => {
    throw pendingSpec;
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.removeItem("jwtToken");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
      <QueryClientProvider client={queryClient}>
        <RouterContextProvider router={router}>
          <PipelineStorageProvider>{children}</PipelineStorageProvider>
        </RouterContextProvider>
      </QueryClientProvider>
    ),
  });
}

describe("remote pipeline editor entry", () => {
  it("keeps the mounted editor session when a workarea draft becomes remote", () => {
    permission.granted = false;
    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Draft" },
        file: { canEdit: true },
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
  it("keeps remote project pipelines read-only without starting editing tools", () => {
    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Shared project graph" },
        file: { canEdit: false },
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
  it("loads remote IDs through the backend-scoped storage reference", () => {
    route.params = { pipelineId: "pipeline-123" };
    renderEditor(<Editor />);

    expect(
      screen.queryByRole("navigation", { name: "Editor navigation" }),
    ).not.toBeInTheDocument();
    expect(loadSpec).toHaveBeenCalledWith({
      source: "remote",
      backendUrl: "https://backend.example.com",
      pipelineId: "pipeline-123",
    });
    expect(initializeEditing).not.toHaveBeenCalled();
    expect(screen.queryByText("Open pipeline")).not.toBeInTheDocument();
  });

  it.each([false, undefined])(
    "preserves viewing without an editing session when write access is %s",
    (canEdit) => {
      route.params = { pipelineId: "pipeline-123" };
      loadSpec.mockReturnValue({
        data: {
          spec: { name: "Remote graph" },
          file: { canEdit },
        },
      });
      renderEditor(<Editor />);
      expect(screen.getByText("Remote graph")).toBeInTheDocument();
      expect(initializeEditing).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("navigation", { name: "Editor navigation" }),
      ).not.toBeInTheDocument();
    },
  );

  it("opens the editor after the remote file verifies write access", async () => {
    route.params = { pipelineId: "pipeline-123" };
    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Remote graph" },
        file: { canEdit: true },
      },
    });
    renderEditor(<Editor />);
    expect(
      await screen.findByRole("navigation", { name: "Editor navigation" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Remote graph")).not.toBeInTheDocument();
    expect(loadSpec).toHaveBeenCalledWith({
      source: "remote",
      backendUrl: backend.backendUrl,
      pipelineId: "pipeline-123",
    });
  });

  it("shows failed remote reads without entering the editor", () => {
    route.params = { pipelineId: "pipeline-123" };
    loadSpec.mockImplementation(() => {
      throw new Error("Pipeline not found");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      renderEditor(<Editor />);
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

  it.each([
    ["deleted", "This pipeline was deleted.", false],
    ["pending", "This pipeline is being deleted.", true],
    ["uncertain", "The deletion result is unknown.", false],
  ] as const)(
    "shows the %s storage barrier with appropriate recovery",
    (state, message, retryable) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      route.params = { pipelineId: "pipeline-123" };
      loadSpec.mockImplementation(() => {
        throw new RemotePipelineDeletionError(state, "Storage barrier");
      });
      renderEditor(<Editor />);
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(Boolean(screen.queryByRole("button", { name: "Retry" }))).toBe(
        retryable,
      );
      expect(
        screen.getByRole("link", { name: "Back to pipelines" }),
      ).toBeInTheDocument();
    },
  );

  it("clears a failed read when navigating to another remote pipeline", () => {
    route.params = { pipelineId: "missing" };
    loadSpec.mockImplementation(() => {
      throw new Error("Pipeline not found");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const { rerender } = renderEditor(<Editor />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to load pipeline. Please try again.",
      );
      route.params = { pipelineId: "available" };
      loadSpec.mockReturnValue({
        data: {
          spec: { name: "Available pipeline" },
          file: { canEdit: false },
        },
      });
      rerender(<Editor />);
      expect(screen.getByText("Available pipeline")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("waits for backend settings before resolving a remote pipeline", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.ready = false;
    renderEditor(<Editor />);
    expect(loadSpec).not.toHaveBeenCalled();
    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("explains when a remote pipeline has no configured backend", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    renderEditor(<Editor />);
    expect(loadSpec).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Configure a backend");
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps settings and Home links inside a deployment base path", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    renderEditor(<Editor />, "/app");
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
    renderEditor(<Editor />, "", true);
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
    [501, "This backend does not support saved pipelines.", false],
    [503, "The backend is unavailable. Check your connection and retry.", true],
  ])(
    "keeps navigation and appropriate recovery available for HTTP %s",
    (status, message, retryable) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      route.params = { pipelineId: "pipeline-123" };
      loadSpec.mockImplementation(() => {
        throw new PipelineSpecApiError("Request failed", status);
      });
      renderEditor(<Editor />);
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
    loadSpec.mockImplementation(() => {
      throw error;
    });
    renderEditor(<Editor />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Recovered pipeline" },
        file: { canEdit: false },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered pipeline")).toBeInTheDocument();
    expect(initializeEditing).not.toHaveBeenCalled();
  });

  it.each([401, 403])("retries an HTTP %s load after signing in", (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    route.params = { pipelineId: "pipeline-123" };
    loadSpec.mockImplementation(() => {
      throw new PipelineSpecApiError("Authentication required", status);
    });
    renderEditor(<Editor />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Authenticated pipeline" },
        file: { canEdit: false },
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
    loadSpec.mockImplementation(() => {
      throw new PipelineSpecApiError("Authentication required", 401);
    });
    renderEditor(<Editor />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    localStorage.removeItem("jwtToken");
    fireEvent(window, new StorageEvent("storage", { key: "jwtToken" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    loadSpec.mockReturnValue({
      data: {
        spec: { name: "Reauthenticated pipeline" },
        file: { canEdit: false },
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
      renderEditor(<Editor />);
      expect(loadSpec).not.toHaveBeenCalled();
      expect(screen.getByText("Open pipeline")).toBeInTheDocument();
    },
  );
});
