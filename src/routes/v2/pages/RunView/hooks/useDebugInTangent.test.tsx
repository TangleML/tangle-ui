import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import { ProjectsApiError } from "@/services/projects/errors";
import {
  createProjectResource,
  listProjectResources,
} from "@/services/projects/projectResourcesService";
import {
  createProject,
  deleteProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import type { ProjectResourceSummary } from "@/services/projects/types";

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
  listProjectResources: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function debugRun() {
  const { result } = renderHook(() => useDebugInTangent(), { wrapper });
  act(() => result.current.start({ runId: "run-7", pipelineName: "Churn" }));
  return result;
}

async function debugRunInNewProject(workspaceId = "ws-1") {
  const result = debugRun();
  await waitFor(() => expect(result.current.choosing).toBeDefined());
  act(() =>
    result.current.choose({ kind: "new", workspaceId, name: "Debug: Churn" }),
  );
  return result;
}

const heldRun = (identity: string): ProjectResourceSummary => ({
  id: "resource-1",
  projectId: "project-3",
  entity: "document",
  name: "Churn",
  entityId: null,
  metadata: { type: "pipeline_run", identity },
  createdBy: null,
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
});

function runBelongsTo(...projectIds: string[]) {
  vi.mocked(useRerunProjectIds).mockReturnValue(
    vi.fn().mockResolvedValue(projectIds),
  );
}

function projectsAre(...ids: string[]) {
  vi.mocked(getProject).mockImplementation(async (id: string) => {
    if (!ids.includes(id)) throw new ProjectsApiError("Not found", 404);
    return {
      id,
      name: `Project ${id}`,
      metadata: { pinned: true },
    } as unknown as Awaited<ReturnType<typeof getProject>>;
  });
}

describe("useDebugInTangent", () => {
  beforeEach(() => {
    runBelongsTo();
    projectsAre("project-3", "project-4");
    vi.mocked(createProject).mockResolvedValue({
      id: "project-9",
    } as unknown as Awaited<ReturnType<typeof createProject>>);
    vi.mocked(updateProject).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof updateProject>>,
    );
    vi.mocked(createProjectResource).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof createProjectResource>>,
    );
    vi.mocked(listProjectResources).mockResolvedValue({
      items: [],
      nextPageToken: null,
      totalCount: 0,
    });
    vi.mocked(deleteProject).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof deleteProject>>,
    );
  });
  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe("a run that belongs to no project", () => {
    it("asks where to debug rather than making a project unasked", async () => {
      const result = debugRun();

      await waitFor(() =>
        expect(result.current.choosing).toEqual({
          run: { runId: "run-7", pipelineName: "Churn" },
          attributed: [],
          newProjectName: "Debug: Churn",
        }),
      );
      expect(createProject).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("makes nothing when the question is dismissed", async () => {
      const result = debugRun();
      await waitFor(() => expect(result.current.choosing).toBeDefined());

      act(() => result.current.dismiss());

      expect(result.current.choosing).toBeUndefined();
      expect(createProject).not.toHaveBeenCalled();
    });

    it("makes the project it was asked for, where it was asked", async () => {
      await debugRunInNewProject("ws-2");

      await waitFor(() =>
        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: "ws-2",
            name: "Debug: Churn",
          }),
        ),
      );
    });

    /**
     * The agent is told what it is here to do through the project's
     * instructions, which is a document rather than a field on the project.
     */
    it("writes the brief as the project's instructions document", async () => {
      await debugRunInNewProject();

      await waitFor(() => expect(createProjectResource).toHaveBeenCalled());
      const [projectId, input] = vi.mocked(createProjectResource).mock.calls[0];
      expect(projectId).toBe("project-9");
      expect(input).toMatchObject({
        entity: "document",
        name: "Instructions",
        metadata: { type: "instructions" },
      });
      expect(input.payload?.content).toContain("run-7");
      expect(input.payload?.content).toContain("project-9");
    });

    it("attaches the failed run as well", async () => {
      await debugRunInNewProject();

      await waitFor(() =>
        expect(createProjectResource).toHaveBeenCalledTimes(2),
      );
      expect(vi.mocked(createProjectResource).mock.calls[1][1]).toMatchObject({
        entity: "document",
        name: "Churn",
        metadata: { type: "pipeline_run" },
      });
    });

    it("opens the project it made on the failed run", async () => {
      await debugRunInNewProject();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({
            params: { projectId: "project-9" },
            search: { open: "run://id/run-7" },
          }),
        ),
      );
    });

    it("remembers the workspace for the next project", async () => {
      await debugRunInNewProject("ws-2");

      await waitFor(() => expect(navigate).toHaveBeenCalled());
      expect(localStorage.getItem("tangle.projects.lastUsedWorkspaceId")).toBe(
        JSON.stringify("ws-2"),
      );
    });

    /** A project holding a brief and no run is worse than no project at all. */
    it("takes the project back out again when attaching fails", async () => {
      vi.mocked(createProjectResource).mockRejectedValue(new Error("nope"));

      await debugRunInNewProject("ws-2");

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
      expect(
        localStorage.getItem("tangle.projects.lastUsedWorkspaceId"),
      ).toBeNull();
    });
  });

  describe("a run that belongs to one project", () => {
    beforeEach(() => runBelongsTo("project-3"));

    it("works in that project without asking", async () => {
      const result = debugRun();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-3" } }),
        ),
      );
      expect(result.current.choosing).toBeUndefined();
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
        metadata: { type: "pipeline_run" },
      });
    });

    /** Debugging the same run twice is one run in the project, not two. */
    it("does not attach a run the project already holds", async () => {
      vi.mocked(listProjectResources).mockResolvedValue({
        items: [heldRun("run://id/run-7")],
        nextPageToken: null,
        totalCount: 1,
      });

      debugRun();

      await waitFor(() => expect(navigate).toHaveBeenCalled());
      expect(createProjectResource).not.toHaveBeenCalled();
      expect(updateProject).toHaveBeenCalled();
    });

    it("carries the brief in on the session it asks for", async () => {
      debugRun();

      await waitFor(() => expect(updateProject).toHaveBeenCalled());
      const [projectId, input] = vi.mocked(updateProject).mock.calls[0];
      expect(projectId).toBe("project-3");
      expect(input.metadata?.startingPrompt).toContain("run-7");
    });

    /** Anything else on the project is somebody's, and a PATCH replaces it all. */
    it("keeps the rest of what the project carries", async () => {
      debugRun();

      await waitFor(() => expect(updateProject).toHaveBeenCalled());
      expect(vi.mocked(updateProject).mock.calls[0][1].metadata).toMatchObject({
        pinned: true,
      });
    });

    /** A backend that merely failed must not offer the run a new project. */
    it("says so rather than asking when the read simply failed", async () => {
      vi.mocked(getProject).mockRejectedValue(
        new ProjectsApiError("Server error", 500),
      );

      const result = debugRun();

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(
          expect.stringContaining("Server error"),
          "error",
        ),
      );
      expect(result.current.choosing).toBeUndefined();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  /**
   * Nothing rewrites a run's attribution when a project is deleted, so the
   * id it carries can name nothing at all.
   */
  describe("a run whose project has been deleted", () => {
    it("asks where to debug, as for a run in no project", async () => {
      runBelongsTo("gone");

      const result = debugRun();

      await waitFor(() =>
        expect(result.current.choosing?.attributed).toEqual([]),
      );
      expect(notify).not.toHaveBeenCalled();
    });

    it("goes straight to the one project the run still has", async () => {
      runBelongsTo("gone", "project-3");

      debugRun();

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-3" } }),
        ),
      );
    });
  });

  /**
   * Attribution is written once and never revised, so a run in two projects
   * cannot be asked which one it meant — only the reader can say.
   */
  describe("a run that belongs to several projects", () => {
    beforeEach(() => runBelongsTo("project-3", "project-4"));

    it("asks which, offering the run's projects", async () => {
      const result = debugRun();

      await waitFor(() =>
        expect(
          result.current.choosing?.attributed.map((project) => project.id),
        ).toEqual(["project-3", "project-4"]),
      );
      expect(navigate).not.toHaveBeenCalled();
    });

    it("debugs in the project picked", async () => {
      const result = debugRun();
      await waitFor(() => expect(result.current.choosing).toBeDefined());

      act(() =>
        result.current.choose({ kind: "existing", projectId: "project-4" }),
      );

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(
          expect.objectContaining({ params: { projectId: "project-4" } }),
        ),
      );
      expect(vi.mocked(updateProject).mock.calls[0][0]).toBe("project-4");
    });
  });
});
