import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import { ProjectsApiError } from "@/services/projects/errors";
import * as projectsService from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";

import { ProjectPage } from "./ProjectPage";

const track = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: vi.fn(),
  useSearch: () => ({}),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/services/projects/useProjectResources", () => ({
  useProjectResources: () => ({
    data: { items: [], nextPageToken: null, totalCount: 0 },
    isPending: false,
    error: null,
  }),
  useProjectResource: () => ({ data: undefined, isPending: true, error: null }),
  useDeleteProjectResource: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateProjectResource: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/services/usePipelineSpec", () => ({
  usePipelineSpec: () => ({ data: undefined, isPending: true, error: null }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: () => ({
    data: { items: [], nextPageToken: null },
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/services/projects/useLocalPipelineStatus", () => ({
  useLocalPipelineStatus: () => ({
    unavailable: new Set(),
    currentNames: new Map(),
  }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/services/projects/useProjectInstructions", () => ({
  useProjectInstructions: () => ({
    instructions: "",
    isPending: false,
    isSaving: false,
    save: vi.fn(),
  }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("@/utils/string", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/utils/URL", () => ({
  getProjectUrl: (id: string) => `https://tangle.example/projects/${id}`,
}));

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Weekly churn scoring",
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 1, document: 1 },
  metadata: null,
};

function mockBackend(
  overrides: Partial<ReturnType<typeof useBackend>> = {},
): void {
  vi.mocked(useBackend).mockReturnValue({
    configured: true,
    available: true,
    ready: true,
    backendUrl: "https://backend.example.com",
    ...overrides,
  } as ReturnType<typeof useBackend>);
}

function mockProject(
  overrides: Partial<ReturnType<typeof useProject>> = {},
): void {
  vi.mocked(useProject).mockReturnValue({
    data: project,
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProject>);
}

describe("ProjectPage", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useParams).mockReturnValue({ projectId: "project-1" });
    mockBackend();
    mockProject();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("shows the project it was asked for", () => {
    render(<ProjectPage />);

    expect(useProject).toHaveBeenCalledWith("project-1");
    expect(screen.getByText("Churn model")).toBeInTheDocument();
    expect(track).toHaveBeenCalledExactlyOnceWith(
      "projects.project_page.impression",
      { project_id: "project-1" },
    );
  });

  it("tracks a visit when loading finishes without counting metadata refreshes", async () => {
    const { useProject: useRealProject } = await vi.importActual<
      typeof import("@/services/projects/useProjects")
    >("@/services/projects/useProjects");
    vi.mocked(useProject).mockImplementation(useRealProject);
    vi.spyOn(projectsService, "getProject").mockResolvedValue(project);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ProjectPage />
      </QueryClientProvider>,
    );
    expect(track).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(track).toHaveBeenCalledExactlyOnceWith(
        "projects.project_page.impression",
        { project_id: "project-1" },
      ),
    );

    act(() => {
      queryClient.setQueryData(ProjectsQueryKeys.Id(project.id), {
        ...project,
        name: "Renamed project",
      });
    });
    expect(await screen.findByText("Renamed project")).toBeInTheDocument();
    expect(track).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it("tracks a new visit when navigating to another project", () => {
    const { rerender } = render(<ProjectPage />);

    vi.mocked(useParams).mockReturnValue({ projectId: "project-2" });
    mockProject({ data: { ...project, id: "project-2" } });
    rerender(<ProjectPage />);

    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenLastCalledWith("projects.project_page.impression", {
      project_id: "project-2",
    });
  });

  it("puts the project's resources, preview, runs and details on one page", () => {
    render(<ProjectPage />);

    expect(
      screen.getByRole("heading", { name: "Resources" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Resource preview" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Runs/ })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Details" }),
    ).toHaveTextContent("alice@example.com");
  });

  it("previews nothing until something is picked", () => {
    render(<ProjectPage />);

    expect(
      screen.getByText("Select a resource to preview it here."),
    ).toBeInTheDocument();
  });

  it("offers a way back to the list", () => {
    render(<ProjectPage />);

    expect(screen.getByText("Back to projects")).toBeInTheDocument();
  });

  it("waits for the backend probe before deciding anything", () => {
    mockBackend({ ready: false });
    render(<ProjectPage />);

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(useProject).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("asks for a backend when none is configured", () => {
    mockBackend({ configured: false });
    render(<ProjectPage />);

    expect(screen.getByText("Backend not configured")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
  });

  it("says when the configured backend cannot be reached", () => {
    mockBackend({ available: false });
    render(<ProjectPage />);

    expect(screen.getByText("Backend not available")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
  });

  it("waits on the project rather than showing an empty page", () => {
    mockProject({ data: undefined, isPending: true });
    render(<ProjectPage />);

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("tells a visitor when the project is not there", () => {
    mockProject({
      data: undefined,
      error: new ProjectsApiError("Failed to fetch project", 404),
    } as Partial<ReturnType<typeof useProject>>);
    render(<ProjectPage />);

    expect(screen.getByText("Project not found")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
    expect(
      screen.getByText("This project does not exist, or it has been deleted."),
    ).toBeInTheDocument();
    expect(screen.getByText("Back to projects")).toBeInTheDocument();
  });

  it("keeps a genuine failure distinct from a missing project", () => {
    mockProject({
      data: undefined,
      error: new ProjectsApiError("backend exploded", 500),
    } as Partial<ReturnType<typeof useProject>>);
    render(<ProjectPage />);

    expect(screen.getByText("Error loading project")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByText("backend exploded")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).toBeNull();
  });

  it("says nothing about the workspace the project lives in", () => {
    render(<ProjectPage />);

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
