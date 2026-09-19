import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProject } from "@/services/projects/useProjects";

import { ProjectWindowContent } from "./ProjectWindowContent";

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

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
    expect(screen.getByDisplayValue("Watch the drift")).toBeInTheDocument();
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
