import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectsApiError } from "@/services/projects/errors";
import { getProject } from "@/services/projects/projectsService";
import {
  ProjectsQueryKeys,
  WorkspacesQueryKeys,
} from "@/services/projects/types";
import { getWorkspace } from "@/services/projects/workspacesService";

import {
  cancelPendingProjectMove,
  useOpenTangentProject,
} from "./useOpenTangentProject";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/services/projects/projectsService", () => ({
  getProject: vi.fn(),
}));

vi.mock("@/services/projects/workspacesService", () => ({
  getWorkspace: vi.fn(),
}));

function open(queryClient = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useOpenTangentProject(), { wrapper });
  return { openProject: result.current, queryClient };
}

type Project = Awaited<ReturnType<typeof getProject>>;

/** `project-1` has to be fetched, and arrives when told to; any other is in hand at once. */
function givenProjectOneIsSlow() {
  let arrive: () => void = () => {};
  vi.mocked(getProject).mockImplementation((id) => {
    const project = { id, workspaceId: "workspace-1" } as Project;
    return id === "project-1"
      ? new Promise<Project>((resolve) => {
          arrive = () => resolve(project);
        })
      : Promise.resolve(project);
  });
  vi.mocked(getWorkspace).mockResolvedValue({
    id: "workspace-1",
  } as Awaited<ReturnType<typeof getWorkspace>>);
  return () => arrive();
}

describe("useOpenTangentProject", () => {
  afterEach(() => vi.resetAllMocks());

  /** The page shows a loading screen until both are known; having them first is what keeps it from flashing one. */
  it("has the project and its workspace in hand before moving there", async () => {
    vi.mocked(getProject).mockResolvedValue({
      id: "project-2",
      workspaceId: "workspace-1",
    } as Awaited<ReturnType<typeof getProject>>);
    vi.mocked(getWorkspace).mockResolvedValue({
      id: "workspace-1",
    } as Awaited<ReturnType<typeof getWorkspace>>);
    const { openProject, queryClient } = open();

    await openProject("project-2", { session: "session-9" });

    expect(
      queryClient.getQueryData(ProjectsQueryKeys.Id("project-2")),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(WorkspacesQueryKeys.Id("workspace-1")),
    ).toBeDefined();
    expect(navigate).toHaveBeenCalledWith({
      to: "/tangent/$projectId",
      params: { projectId: "project-2" },
      search: { session: "session-9" },
    });
  });

  it("still moves there when the project cannot be read, so the page can say why", async () => {
    vi.mocked(getProject).mockRejectedValue(
      new ProjectsApiError("Project not found", 404),
    );
    const { openProject } = open();

    await openProject("project-2", { session: "new" });

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: { projectId: "project-2" } }),
    );
  });

  /** Each project's sessions are a list of their own, with their own copy of the hook. */
  it("lands on the project asked for last, whichever list asked and whichever loads first", async () => {
    const arrive = givenProjectOneIsSlow();
    const oneList = open();
    const anotherList = open();

    const earlier = oneList.openProject("project-1", { session: "session-1" });
    await anotherList.openProject("project-2", { session: "session-2" });
    arrive();
    await earlier;

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: { projectId: "project-2" } }),
    );
  });

  it("stays put once a move still loading is cancelled", async () => {
    const arrive = givenProjectOneIsSlow();
    const { openProject } = open();

    const move = openProject("project-1", { session: "session-1" });
    cancelPendingProjectMove();
    arrive();
    await move;

    expect(navigate).not.toHaveBeenCalled();
  });
});
