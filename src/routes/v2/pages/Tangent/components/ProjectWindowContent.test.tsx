import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProject } from "@/services/projects/useProjects";

import { ProjectWindowContent } from "./ProjectWindowContent";

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutate: deleteProject, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

const deleteProject = vi.fn();
const navigate = vi.fn();

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

const project = {
  id: "project-1",
  name: "Churn model",
  description: "Q3 churn work",
  notes: "Watch the drift",
  workspaceId: "workspace-1",
  createdBy: "alice@example.com",
  origin: "user",
  extraData: null,
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 1 },
};

function mockProject(overrides: Record<string, unknown> = {}) {
  vi.mocked(useProject).mockReturnValue({
    data: { ...project, ...overrides },
    isPending: false,
  } as unknown as ReturnType<typeof useProject>);
}

describe("ProjectWindowContent", () => {
  beforeEach(() => mockProject());
  afterEach(() => vi.resetAllMocks());

  it("shows what the project is for without leaving Tangent", () => {
    render(<ProjectWindowContent />);

    expect(screen.getByDisplayValue("Q3 churn work")).toBeInTheDocument();
  });

  /**
   * Notes are the agent's instructions here, edited under that name from the
   * Resources window, so a box calling them Notes would be a second name for
   * one field.
   */
  it("leaves the notes to the instructions that own them", () => {
    render(<ProjectWindowContent />);

    expect(screen.queryByText("Notes")).toBeNull();
    expect(screen.queryByDisplayValue("Watch the drift")).toBeNull();
  });

  it("shows who made it and when", () => {
    render(<ProjectWindowContent />);

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Created by")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("says nothing about the workspace the project lives in", () => {
    render(<ProjectWindowContent />);

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });

  it("waits rather than claiming an empty project", () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useProject>);

    render(<ProjectWindowContent />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});

describe("deleting the project from Tangent", () => {
  beforeEach(() => mockProject());
  afterEach(() => vi.resetAllMocks());

  it("offers it here, so it need not be done from the project's own page", () => {
    render(<ProjectWindowContent />);

    expect(
      screen.getByRole("button", { name: "Delete project" }),
    ).toBeInTheDocument();
  });

  /** Destroying a project is not something a stray click should achieve. */
  it("asks before destroying anything", async () => {
    const user = userEvent.setup();
    render(<ProjectWindowContent />);

    await user.click(screen.getByRole("button", { name: "Delete project" }));

    const dialog = await screen.findByRole("alertdialog");

    expect(dialog).toHaveTextContent('Delete "Churn model"?');
    expect(dialog).toHaveTextContent("This will also delete 1 pipeline");
    expect(deleteProject).not.toHaveBeenCalled();
  });
});
