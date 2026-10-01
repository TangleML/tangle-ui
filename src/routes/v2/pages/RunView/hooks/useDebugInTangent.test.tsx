import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import { ProjectsApiError } from "@/services/projects/errors";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { useDebugInTangent } from "./useDebugInTangent";

const navigate = vi.fn();
const notify = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/hooks/useRerunProjectIds", () => ({
  useRerunProjectIds: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
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

function debugRun(projectId?: string) {
  const { result } = renderHook(() => useDebugInTangent(), { wrapper });
  act(() =>
    result.current.debug({ runId: "run-7", pipelineName: "Churn", projectId }),
  );
  return result;
}

function runBelongsTo(...projectIds: string[]) {
  vi.mocked(useRerunProjectIds).mockReturnValue(
    vi.fn().mockResolvedValue(projectIds),
  );
}

describe("useDebugInTangent", () => {
  beforeEach(() => {
    runBelongsTo();
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [{ id: "ws-1", isActive: true }],
    } as unknown as ReturnType<typeof useWorkspaces>);
    vi.mocked(createProject).mockResolvedValue({
      id: "project-9",
    } as unknown as Awaited<ReturnType<typeof createProject>>);
    vi.mocked(getProject).mockResolvedValue({
      id: "project-3",
      name: "Churn model",
      extraData: { pinned: true },
    } as unknown as Awaited<ReturnType<typeof getProject>>);
    vi.mocked(updateProject).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof updateProject>>,
    );
    vi.mocked(createProjectResource).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createProjectResource>>,
    );
    vi.mocked(deleteProject).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof deleteProject>>,
    );
  });
  afterEach(() => vi.resetAllMocks());

  describe("a run that belongs to no project", () => {
    /**
     * The agent is told what it is here to do through the project's
     * instructions, which is a document rather than a field on the project.
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

      await waitFor(() =>
        expect(createProjectResource).toHaveBeenCalledTimes(2),
      );
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

  describe("a run that belongs to a project", () => {
    beforeEach(() => runBelongsTo("project-3"));

    it("works in that project rather than making another", async () => {
      debugRun();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-3" } }),
        ),
      );
      expect(createProject).not.toHaveBeenCalled();
    });

    /**
     * A project holds one instructions document and the oldest wins, so a
     * second one is read by nobody and quietly replaces nothing.
     */
    it("leaves the instructions the project already has alone", async () => {
      debugRun();

      await waitFor(() => expect(createProjectResource).toHaveBeenCalled());
      expect(createProjectResource).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createProjectResource).mock.calls[0][1]).toMatchObject({
        extraData: { type: "pipeline_run" },
      });
    });

    it("carries the brief in on the session it asks for", async () => {
      debugRun();

      await waitFor(() => expect(updateProject).toHaveBeenCalled());
      const [projectId, input] = vi.mocked(updateProject).mock.calls[0];
      expect(projectId).toBe("project-3");
      expect(input.extraData?.startingPrompt).toContain("run-7");
    });

    /** Anything else on the project is somebody's, and a PATCH replaces it all. */
    it("keeps the rest of what the project carries", async () => {
      debugRun();

      await waitFor(() => expect(updateProject).toHaveBeenCalled());
      expect(vi.mocked(updateProject).mock.calls[0][1].extraData).toMatchObject(
        { pinned: true },
      );
    });

    /**
     * Nothing rewrites a run's attribution when a project is deleted, so the
     * id it carries can name nothing at all. Debugging still has to work.
     */
    it("makes a project when the one the run names has been deleted", async () => {
      vi.mocked(getProject).mockRejectedValue(
        new ProjectsApiError("Not found", 404),
      );

      debugRun();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-9" } }),
        ),
      );
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Debug: Churn" }),
      );
      expect(notify).not.toHaveBeenCalled();
    });

    it("moves on to the next project the run names", async () => {
      runBelongsTo("gone", "project-3");
      vi.mocked(getProject).mockImplementation(async (id: string) => {
        if (id === "gone") throw new ProjectsApiError("Not found", 404);
        return { id, name: "Churn model" } as unknown as Awaited<
          ReturnType<typeof getProject>
        >;
      });

      debugRun();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-3" } }),
        ),
      );
      expect(createProject).not.toHaveBeenCalled();
    });

    /** A backend that merely failed must not strand the run somewhere new. */
    it("says so rather than making a project when the read simply failed", async () => {
      vi.mocked(getProject).mockRejectedValue(
        new ProjectsApiError("Server error", 500),
      );

      debugRun();

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(
          expect.stringContaining("Server error"),
          "error",
        ),
      );
      expect(createProject).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("debugs in the project it is handed when a run has several", async () => {
      runBelongsTo("project-3", "project-4");
      vi.mocked(getProject).mockResolvedValue({
        id: "project-4",
      } as unknown as Awaited<ReturnType<typeof getProject>>);

      debugRun("project-4");

      await waitFor(() => expect(getProject).toHaveBeenCalledWith("project-4"));
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ params: { projectId: "project-4" } }),
      );
    });
  });
});
