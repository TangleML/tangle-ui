import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pointerTo } from "@/services/localPipelines/localPipelinesService";

import type { ProjectPipelineRef } from "./pipelineResource";
import { listProjectResources } from "./projectResourcesService";
import { localPipelineResourceInput } from "./resourceDescriptor";
import type { ProjectResourceSummary, ProjectSummary } from "./types";
import { usePipelineProjects } from "./usePipelineProjects";
import { useReachableProjects } from "./useReachableProjects";

const PIPELINE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ configured: true, available: true }),
}));

vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  pointerTo: vi.fn(),
}));

vi.mock("./projectResourcesService", () => ({
  listProjectResources: vi.fn(),
}));

vi.mock("./useReachableProjects", () => ({
  useReachableProjects: vi.fn(),
}));

let queryClient: QueryClient;

function row(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "pipeline",
    name: "Churn model",
    entityId: null,
    metadata: null,
    createdBy: null,
    createdAt: new Date("2026-10-30T10:00:00Z"),
    updatedAt: new Date("2026-10-30T10:00:00Z"),
    ...overrides,
  };
}

function givenProjects(
  resourcesByProject: Record<string, ProjectResourceSummary[]>,
) {
  vi.mocked(useReachableProjects).mockReturnValue({
    projects: Object.keys(resourcesByProject).map(
      (id) => ({ id, name: `Project ${id}` }) as ProjectSummary,
    ),
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useReachableProjects>);
  vi.mocked(listProjectResources).mockImplementation(async (projectId) => ({
    items: resourcesByProject[projectId] ?? [],
    nextPageToken: null,
    totalCount: resourcesByProject[projectId]?.length ?? 0,
  }));
}

const lookUp = (pipeline: ProjectPipelineRef) =>
  renderHook(() => usePipelineProjects(pipeline), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

describe("usePipelineProjects", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.resetAllMocks();
  });

  it("finds the projects that hold a backend pipeline by its id", async () => {
    givenProjects({
      "project-1": [row({ id: "resource-7", entityId: PIPELINE_ID })],
      "project-2": [row({ entityId: "1b4e28ba-2fa1-11d2-883f-0016d3cca427" })],
    });

    const { result } = lookUp({
      source: "remote",
      pipelineId: PIPELINE_ID,
      name: "Churn model",
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(
      result.current.memberships.map(({ project, resource }) => [
        project.id,
        resource.id,
      ]),
    ).toEqual([["project-1", "resource-7"]]);
    expect(pointerTo).not.toHaveBeenCalled();
  });

  it("finds the projects that point at a browser pipeline", async () => {
    vi.mocked(pointerTo).mockResolvedValue({ localName: "Churn model" });
    givenProjects({
      "project-1": [
        row({
          id: "resource-3",
          ...localPipelineResourceInput({ localName: "Churn model" }),
          entityId: null,
        }),
      ],
      "project-2": [],
    });

    const { result } = lookUp({ source: "local", name: "Churn model" });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.memberships.map(({ project }) => project.id)).toEqual(
      ["project-1"],
    );
  });
});
