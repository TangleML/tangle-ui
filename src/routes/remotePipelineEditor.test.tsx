import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Editor from "./Editor/Editor";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";
import { EmbeddedPipelineEditor } from "./v2/pages/Editor/EmbeddedPipelineEditor";

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
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
const navigate = vi.hoisted(() => vi.fn());
const migrateLocal = vi.hoisted(() => vi.fn());
const pendingSpec = new Promise<never>(() => {});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useParams: () => route.params,
  useSearch: () => route.search,
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({
      matches: [
        { params: route.params, search: route.search, context: route.context },
      ],
    }),
}));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: () => backend }));
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

describe("remote pipeline editor entry", () => {
  it("requests local file permission before reading an embedded pipeline", () => {
    permission.granted = false;
    render(
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
    render(
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
    render(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Configure a backend");
  });
  it("redirects legacy remote URLs to the V2 editor", () => {
    route.params = { pipelineId: "pipeline-123" };
    route.search = { projectId: "project-1" };
    render(<Editor />);

    expect(loadLegacy).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/editor-v2/remote/$pipelineId",
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
      render(<View />);
      expect(loadLegacy).not.toHaveBeenCalled();
      expect(migrateLocal.mock.calls[0][0]).toMatchObject({
        pipelineRef: { name: "Local pipeline", fileId: "local-1" },
        projectId: "project-1",
      });
      fireEvent.click(screen.getByRole("button", { name: "Finish migration" }));
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/editor-v2/remote/$pipelineId",
          params: { pipelineId: "remote-1" },
          search: { projectId: "project-1" },
          replace: true,
        }),
      );
    },
  );

  it("requests legacy local file permission before migration", () => {
    route.params = { name: "Local pipeline" };
    permission.granted = false;
    render(<Editor />);
    expect(screen.getByText("Grant Access")).toBeInTheDocument();
    expect(migrateLocal).not.toHaveBeenCalled();
    expect(loadLegacy).not.toHaveBeenCalled();
  });

  it("continues loading a local pipeline named remote in the legacy editor", () => {
    route.params = { name: "remote" };
    render(<Editor />);

    expect(loadLegacy).toHaveBeenCalled();
    expect(screen.getByText("Loading Pipeline")).toBeInTheDocument();
  });

  it("loads remote IDs through the backend-scoped V2 storage reference", () => {
    route.params = { pipelineId: "pipeline-123" };
    route.search = { fileId: "local-file-id" };
    render(<EditorV2 />);

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
      render(<EditorV2 />);
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
    render(<EditorV2 />);
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
      render(<EditorV2 />);
      expect(screen.getByRole("alert")).toHaveTextContent("Pipeline not found");
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
      const { rerender } = render(<EditorV2 />);
      expect(screen.getByRole("alert")).toHaveTextContent("Pipeline not found");
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
    render(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
  });

  it("explains when a remote pipeline has no configured backend", () => {
    route.params = { pipelineId: "pipeline-123" };
    backend.configured = false;
    render(<EditorV2 />);
    expect(loadV2).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Configure a backend");
  });

  it("continues resolving local names and file IDs in V2", () => {
    route.search = { fileId: "local-file-id" };
    render(<EditorV2 />);

    expect(loadV2).toHaveBeenCalledWith({
      name: "pipeline-123",
      fileId: "local-file-id",
    });
    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
  });

  it("continues loading a local pipeline named remote in V2", () => {
    route.params = { pipelineName: "remote" };
    render(<EditorV2 />);

    expect(loadV2).toHaveBeenCalledWith({ name: "remote", fileId: undefined });
  });

  it("honors an explicit pipeline reference even on a remote route", () => {
    route.params = { pipelineId: "pipeline-123" };
    render(<EditorV2 pipelineRef={{ name: "tour-pipeline" }} />);

    expect(loadV2).toHaveBeenCalledWith({ name: "tour-pipeline" });
  });

  it("honors an explicit empty pipeline reference", () => {
    route.params = { pipelineId: "pipeline-123" };
    render(<EditorV2 pipelineRef={null} />);

    expect(screen.getByText("Open local pipeline")).toBeInTheDocument();
    expect(loadV2).not.toHaveBeenCalled();
  });
});
