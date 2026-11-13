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

import { useOpenTangentProject } from "./useOpenTangentProject";

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
});
