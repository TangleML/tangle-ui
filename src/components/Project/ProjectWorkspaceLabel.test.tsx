import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, Workspace } from "@/services/projects/types";
import { useWorkspace } from "@/services/projects/useWorkspaces";
import type { TeamMembership } from "@/services/teams/types";
import { useUserTeams } from "@/services/teams/useUserTeams";

import { ProjectWorkspaceLabel } from "./ProjectWorkspaceLabel";

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspace: vi.fn(),
}));

vi.mock("@/services/teams/useUserTeams", () => ({
  useUserTeams: vi.fn(),
}));

const TEAM_ID = "search-team@example.iam.gserviceaccount.com";

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: null,
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: {},
  metadata: null,
};

const teamWorkspace: Workspace = {
  id: "workspace-1",
  name: "Search",
  description: null,
  isActive: true,
  metadata: { teamId: TEAM_ID },
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

function renderLabel({
  workspace = teamWorkspace,
  memberships,
}: {
  workspace?: Workspace | null;
  memberships?: TeamMembership[];
} = {}) {
  vi.mocked(useWorkspace).mockReturnValue({
    data: workspace ?? undefined,
  } as ReturnType<typeof useWorkspace>);
  vi.mocked(useUserTeams).mockReturnValue({
    data: memberships,
  } as ReturnType<typeof useUserTeams>);
  return render(<ProjectWorkspaceLabel project={project} />);
}

describe("ProjectWorkspaceLabel", () => {
  beforeEach(() => {
    window.__TANGLE_TEAM_IMPERSONATION__ = {
      headerName: "x-tangle-impersonate-team-id",
    };
  });

  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
    vi.clearAllMocks();
  });

  it("names the workspace and the user's role in its team, not the team", () => {
    renderLabel({ memberships: [{ teamId: TEAM_ID, roles: ["editor"] }] });

    expect(screen.getByTestId("project-workspace")).toHaveTextContent(
      "Search· Editor",
    );
    expect(screen.getByLabelText("Workspace")).toBeInTheDocument();
    expect(screen.getByTestId("project-workspace")).not.toHaveTextContent(
      TEAM_ID,
    );
    expect(screen.queryByTitle(TEAM_ID)).toBeNull();
    expect(useWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(useUserTeams).toHaveBeenCalledWith({ enabled: true });
  });

  it.each<[TeamMembership[], string]>([
    [[{ teamId: TEAM_ID, roles: ["editor"] }], "· Editor"],
    [[{ teamId: TEAM_ID, roles: ["reader"] }], "· Reader"],
    [[{ teamId: TEAM_ID, roles: ["reader", "editor"] }], "· Editor"],
    [[{ teamId: TEAM_ID, roles: ["nobody"] }], "· No access"],
    [
      [{ teamId: "other-team@example.com", roles: ["editor"] }],
      "· Not a member",
    ],
    [[], "· Not a member"],
  ])("gives the user's role in the team: %o", (memberships, role) => {
    renderLabel({ memberships });

    expect(screen.getByTestId("project-team-role")).toHaveTextContent(role);
  });

  it("names only the workspace before the user's role is known", () => {
    renderLabel({ memberships: undefined });

    expect(screen.getByTestId("project-workspace")).toHaveTextContent("Search");
    expect(screen.queryByTestId("project-team-role")).toBeNull();
  });

  it("names only the workspace when it has no team", () => {
    renderLabel({
      workspace: { ...teamWorkspace, metadata: null },
      memberships: [{ teamId: TEAM_ID, roles: ["editor"] }],
    });

    expect(screen.getByTestId("project-workspace")).toHaveTextContent("Search");
    expect(screen.queryByTestId("project-team-role")).toBeNull();
    expect(useUserTeams).toHaveBeenCalledWith({ enabled: false });
  });

  it("gives no role while the host has teams switched off", () => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
    renderLabel({ memberships: [{ teamId: TEAM_ID, roles: ["editor"] }] });

    expect(screen.queryByTestId("project-team-role")).toBeNull();
    expect(useUserTeams).toHaveBeenCalledWith({ enabled: false });
  });

  it("shows nothing until the workspace loads", () => {
    renderLabel({ workspace: null });

    expect(screen.queryByTestId("project-workspace")).toBeNull();
  });
});
