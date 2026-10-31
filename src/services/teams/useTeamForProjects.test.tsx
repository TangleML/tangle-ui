import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/projects/projectsService");
vi.mock("@/services/projects/workspacesService");
vi.mock("./teamIdentityService");

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ configured: true, available: true }),
}));

import { ProjectsApiError } from "@/services/projects/errors";
import { getProject } from "@/services/projects/projectsService";
import {
  type Project,
  ProjectsQueryKeys,
  type Workspace,
  WorkspacesQueryKeys,
} from "@/services/projects/types";
import { getWorkspace } from "@/services/projects/workspacesService";

import { TeamIdentityError } from "./errors";
import { fetchTeamIdentity, fetchTeamMemberships } from "./teamIdentityService";
import { type TeamMembership, TeamsQueryKeys } from "./types";
import { useTeamForProjects } from "./useTeamForProjects";

const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
const OTHER_TEAM_ID = "data-team@project.iam.gserviceaccount.com";

const workspaces: Record<string, Workspace> = {
  research: {
    id: "research",
    name: "ML Research",
    description: null,
    isActive: true,
    metadata: { teamId: TEAM_ID },
    createdAt: new Date("2026-10-01T00:00:00Z"),
  },
  data: {
    id: "data",
    name: "Data",
    description: null,
    isActive: true,
    metadata: { teamId: OTHER_TEAM_ID },
    createdAt: new Date("2026-10-01T00:00:00Z"),
  },
  sandbox: {
    id: "sandbox",
    name: "Sandbox",
    description: null,
    isActive: true,
    metadata: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  },
};

const projectIn = (id: string, workspaceId: string): Project => ({
  id,
  workspaceId,
  name: id,
  description: null,
  createdBy: "alice@example.com",
  origin: "user",
  createdAt: new Date("2026-10-02T00:00:00Z"),
  updatedAt: new Date("2026-10-02T00:00:00Z"),
  resourceCounts: {},
  metadata: null,
});

const projects: Record<string, Project> = {
  "research-project": projectIn("research-project", "research"),
  "data-project": projectIn("data-project", "data"),
  "sandbox-project": projectIn("sandbox-project", "sandbox"),
};

const aliceTeams: TeamMembership[] = [{ teamId: TEAM_ID, roles: ["editor"] }];

const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const renderTeam = (projectIds: string[], queryClient = testQueryClient()) =>
  renderHook(() => useTeamForProjects(projectIds), {
    wrapper: createWrapper(queryClient),
  });

describe("useTeamForProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__TANGLE_TEAM_IMPERSONATION__ = {
      headerName: "x-tangle-impersonate-team-id",
    };
    vi.mocked(getProject).mockImplementation(async (id) => {
      const project = projects[id];
      if (!project) throw new ProjectsApiError("Project not found", 404);
      return project;
    });
    vi.mocked(getWorkspace).mockImplementation(async (id) => workspaces[id]);
    vi.mocked(fetchTeamMemberships).mockResolvedValue(aliceTeams);
    vi.mocked(fetchTeamIdentity).mockResolvedValue({
      id: TEAM_ID,
      permissions: ["read", "write"],
    });
  });

  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
  });

  it("is none, and looks nothing up, without the host's header config", () => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;

    const { result } = renderTeam(["research-project"]);

    expect(result.current).toEqual({ status: "none" });
    expect(getProject).not.toHaveBeenCalled();
  });

  it("doesn't ask for the team's identity without the header config, even with everything cached", async () => {
    const queryClient = testQueryClient();
    queryClient.setQueryData(
      ProjectsQueryKeys.Id("research-project"),
      projects["research-project"],
    );
    queryClient.setQueryData(
      WorkspacesQueryKeys.Id("research"),
      workspaces.research,
    );
    queryClient.setQueryData(TeamsQueryKeys.Memberships(), aliceTeams);
    delete window.__TANGLE_TEAM_IMPERSONATION__;

    const { result } = renderTeam(["research-project"], queryClient);
    await act(async () => {});

    expect(result.current).toEqual({ status: "none" });
    expect(fetchTeamIdentity).not.toHaveBeenCalled();
  });

  it("is active once the backend confirms the user can act as the team", async () => {
    const { result } = renderTeam(["research-project"]);

    expect(result.current).toEqual({ status: "resolving" });
    await waitFor(() =>
      expect(result.current).toEqual({
        status: "active",
        team: { id: TEAM_ID, label: "ML Research", canWrite: true },
      }),
    );
    expect(fetchTeamIdentity).toHaveBeenCalledWith(TEAM_ID);
  });

  it("is not-member, without asking the backend, for a team the user is not in", async () => {
    const { result } = renderTeam(["data-project"]);

    await waitFor(() =>
      expect(result.current).toEqual({
        status: "not-member",
        team: { id: OTHER_TEAM_ID, label: "Data" },
      }),
    );
    expect(fetchTeamIdentity).not.toHaveBeenCalled();
  });

  it("reports a failed lookup of the user's teams rather than calling them not a member", async () => {
    const failure = new TeamIdentityError(
      "Failed to list your teams: Authentication required",
      401,
    );
    vi.mocked(fetchTeamMemberships).mockRejectedValue(failure);

    const { result } = renderTeam(["research-project"]);

    await waitFor(() =>
      expect(result.current).toEqual({ status: "error", error: failure }),
    );
    expect(fetchTeamIdentity).not.toHaveBeenCalled();
  });

  it("is a conflict for projects whose workspaces map to different teams", async () => {
    const { result } = renderTeam(["research-project", "data-project"]);

    await waitFor(() =>
      expect(result.current).toEqual({
        status: "conflict",
        teams: [
          { id: TEAM_ID, label: "ML Research" },
          { id: OTHER_TEAM_ID, label: "Data" },
        ],
      }),
    );
    expect(fetchTeamIdentity).not.toHaveBeenCalled();
  });

  it("takes the team of the one project that has one", async () => {
    const { result } = renderTeam(["sandbox-project", "research-project"]);

    await waitFor(() => expect(result.current.status).toBe("active"));
  });

  it("is none for a project whose workspace names no team", async () => {
    const { result } = renderTeam(["sandbox-project"]);

    await waitFor(() => expect(result.current).toEqual({ status: "none" }));
    expect(fetchTeamIdentity).not.toHaveBeenCalled();
  });

  it("ignores a project that no longer exists", async () => {
    const { result } = renderTeam(["deleted-project", "research-project"]);

    await waitFor(() => expect(result.current.status).toBe("active"));
  });
});
