import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import {
  createProjectResource,
  listProjectResources,
} from "@/services/projects/projectResourcesService";
import {
  createProject,
  getProject,
  updateProject,
} from "@/services/projects/projectsService";
import type { Project, ProjectResource } from "@/services/projects/types";

import { useOpenInTangent } from "./useOpenInTangent";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

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

function openRun() {
  const { result } = renderHook(() => useOpenInTangent(), { wrapper });
  act(() => result.current.start({ runId: "run-7", pipelineName: "Churn" }));
  return result;
}

async function openRunInNewProject(name: string) {
  const result = openRun();
  await waitFor(() => expect(result.current.choosing).toBeDefined());
  act(() => result.current.choose({ kind: "new", workspaceId: "ws-1", name }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
}

const project = (id: string): Project => ({
  id,
  workspaceId: "ws-1",
  name: "Churn",
  description: null,
  createdBy: null,
  origin: "agent",
  metadata: null,
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
  resourceCounts: {},
});

const attachedRun: ProjectResource = {
  id: "resource-1",
  projectId: "project-9",
  entity: "document",
  name: "Churn",
  entityId: null,
  metadata: { type: "pipeline_run", identity: "run://id/run-7" },
  createdBy: null,
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
  payload: null,
};

function runBelongsTo(...projectIds: string[]) {
  vi.mocked(useRerunProjectIds).mockReturnValue(
    vi.fn().mockResolvedValue(projectIds),
  );
}

describe("useOpenInTangent", () => {
  beforeEach(() => {
    runBelongsTo();
    vi.mocked(getProject).mockResolvedValue(project("project-3"));
    vi.mocked(createProject).mockResolvedValue(project("project-9"));
    vi.mocked(createProjectResource).mockResolvedValue(attachedRun);
    vi.mocked(listProjectResources).mockResolvedValue({
      items: [],
      nextPageToken: null,
      totalCount: 0,
    });
  });
  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("opens the run in a new, empty session of the run's project", async () => {
    runBelongsTo("project-3");

    openRun();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { projectId: "project-3" },
          search: { open: "run://id/run-7", session: "new" },
        }),
      ),
    );
  });

  it("asks nothing of the session it starts", async () => {
    runBelongsTo("project-3");

    openRun();

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("offers a new project named after the pipeline", async () => {
    const result = openRun();

    await waitFor(() =>
      expect(result.current.choosing?.newProjectName).toBe("Churn"),
    );
  });

  it("gives a new project the run and nothing else", async () => {
    await openRunInNewProject("Churn");

    expect(createProjectResource).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createProjectResource).mock.calls[0][1]).toMatchObject({
      metadata: { type: "pipeline_run" },
    });
  });

  /** A name nobody chose is the agent's to improve once it knows the work. */
  it("lets the agent rename a project that kept the suggested name", async () => {
    await openRunInNewProject("Churn");

    expect(vi.mocked(createProject).mock.calls[0][0].metadata).toEqual({
      provisionalName: true,
    });
  });

  it("keeps a name someone typed", async () => {
    await openRunInNewProject("Churn retraining");

    expect(vi.mocked(createProject).mock.calls[0][0].metadata).toEqual({});
  });
});
