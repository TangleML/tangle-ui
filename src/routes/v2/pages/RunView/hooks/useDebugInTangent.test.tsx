import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
} from "@/services/projects/projectsService";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { useDebugInTangent } from "./useDebugInTangent";

const navigate = vi.fn();
const notify = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/services/projects/projectsService", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}));

vi.mock("@/services/projects/projectResourcesService", () => ({
  createProjectResource: vi.fn(),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function debugRun() {
  const { result } = renderHook(() => useDebugInTangent(), { wrapper });
  act(() => result.current.debug({ runId: "run-7", pipelineName: "Churn" }));
  return result;
}

describe("useDebugInTangent", () => {
  beforeEach(() => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [{ id: "ws-1", isActive: true }],
    } as unknown as ReturnType<typeof useWorkspaces>);
    vi.mocked(createProject).mockResolvedValue({
      id: "project-9",
    } as unknown as Awaited<ReturnType<typeof createProject>>);
    vi.mocked(createProjectResource).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createProjectResource>>,
    );
    vi.mocked(deleteProject).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof deleteProject>>,
    );
  });
  afterEach(() => vi.resetAllMocks());

  /**
   * The agent is told what it is here to do through the project's instructions,
   * which is a document rather than a field on the project.
   */
  it("writes the brief as the project's instructions document", async () => {
    debugRun();

    await waitFor(() => expect(createProjectResource).toHaveBeenCalled());
    const [projectId, input] = vi.mocked(createProjectResource).mock.calls[0];
    expect(projectId).toBe("project-9");
    expect(input).toMatchObject({
      entity: "document",
      name: "Instructions",
      extraData: { type: "instructions" },
    });
    expect(input.payload?.content).toContain("run-7");
    expect(input.payload?.content).toContain("project-9");
  });

  it("attaches the failed run as well", async () => {
    debugRun();

    await waitFor(() => expect(createProjectResource).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createProjectResource).mock.calls[1][1]).toMatchObject({
      entity: "document",
      name: "Churn",
      extraData: { type: "pipeline_run" },
    });
  });

  it("opens the project it made", async () => {
    debugRun();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ params: { projectId: "project-9" } }),
      ),
    );
  });

  /** A project holding a brief and no run is worse than no project at all. */
  it("takes the project back out again when attaching fails", async () => {
    vi.mocked(createProjectResource).mockRejectedValue(new Error("nope"));

    debugRun();

    await waitFor(() =>
      expect(deleteProject).toHaveBeenCalledWith("project-9"),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining("nope"),
        "error",
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("says so rather than making a project with nowhere to put it", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useWorkspaces>);

    debugRun();

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining("No workspace"),
        "error",
      ),
    );
    expect(createProject).not.toHaveBeenCalled();
  });
});
