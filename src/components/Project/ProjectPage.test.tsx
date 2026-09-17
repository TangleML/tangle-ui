import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import { ProjectsApiError } from "@/services/projects/errors";
import type { Project } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";

import { ProjectPage } from "./ProjectPage";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ projectId: "project-1" }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
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
  notes: null,
};

function mockBackend(
  overrides: Partial<ReturnType<typeof useBackend>> = {},
): void {
  vi.mocked(useBackend).mockReturnValue({
    configured: true,
    available: true,
    ready: true,
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
    mockBackend();
    mockProject();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows the project it was asked for", () => {
    render(<ProjectPage />);

    expect(useProject).toHaveBeenCalledWith("project-1");
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  it("attributes the project and dates it", () => {
    render(<ProjectPage />);

    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Created Sep 9/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("leaves the attribution out when nobody is recorded", () => {
    mockProject({ data: { ...project, createdBy: null } });
    render(<ProjectPage />);

    expect(screen.getByText(/^Created Sep 9/)).toBeInTheDocument();
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
  });

  it("asks for a backend when none is configured", () => {
    mockBackend({ configured: false });
    render(<ProjectPage />);

    expect(screen.getByText("Backend not configured")).toBeInTheDocument();
  });

  it("says when the configured backend cannot be reached", () => {
    mockBackend({ available: false });
    render(<ProjectPage />);

    expect(screen.getByText("Backend not available")).toBeInTheDocument();
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
    expect(screen.getByText("backend exploded")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).toBeNull();
  });

  it("says nothing about the workspace the project lives in", () => {
    render(<ProjectPage />);

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
