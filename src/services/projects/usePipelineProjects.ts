import { useQueries, useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";
import { MINUTES } from "@/utils/constants";

import {
  PIPELINE_RESOURCE_PARAMS,
  pipelineResourceIn,
} from "./pipelineProjects";
import { listProjectResources } from "./projectResourcesService";
import type { ProjectResourceSummary, ProjectSummary } from "./types";
import { ProjectResourcesQueryKeys } from "./types";
import { useReachableProjects } from "./useReachableProjects";

export interface PipelineProjectMembership {
  project: ProjectSummary;
  resource: ProjectResourceSummary;
}

export interface PipelineProjects {
  memberships: PipelineProjectMembership[];
  isPending: boolean;
  error: Error | null;
}

/**
 * Which of the reader's projects hold a given pipeline. There is no asking the
 * backend that question — no endpoint answers it and resources cannot be
 * filtered by what they point at — so it is one resource listing per project,
 * read through the same query the project page uses so that adding a pipeline
 * to a project is already reflected here.
 *
 * Only the first page of projects, and of each project's resources, is
 * consulted.
 *
 * One listing per project is dear enough that callers which only need the
 * answer on demand should pass `enabled: false` until then.
 */
export function usePipelineProjects(
  pipelineName: string | undefined,
  { enabled: wanted = true }: { enabled?: boolean } = {},
): PipelineProjects {
  const { configured, available } = useBackend();
  const enabled = wanted && configured && available && Boolean(pipelineName);

  const { data: pointer, error: pointerError } = useQuery({
    queryKey: LocalPipelinesQueryKeys.Pointer({
      localName: pipelineName ?? "",
    }),
    queryFn: () => pointerTo(pipelineName ?? ""),
    enabled,
    staleTime: 1 * MINUTES,
  });

  const {
    projects,
    isPending: isListPending,
    error: listError,
  } = useReachableProjects({ enabled });

  const candidates: ProjectSummary[] = enabled ? projects : [];

  const resources = useQueries({
    queries: candidates.map((project) => ({
      queryKey: ProjectResourcesQueryKeys.List(
        project.id,
        PIPELINE_RESOURCE_PARAMS,
      ),
      queryFn: () => listProjectResources(project.id, PIPELINE_RESOURCE_PARAMS),
      enabled,
      staleTime: 5 * MINUTES,
    })),
  });

  // A lookup that failed is not one still running: reported as pending, the
  // picker would sit on its spinner for as long as it stayed open.
  const error =
    pointerError ??
    listError ??
    resources.find((query) => query.error)?.error ??
    null;

  const isPending =
    enabled &&
    error === null &&
    (isListPending || !pointer || resources.some((query) => query.isPending));

  if (!pointer) {
    return { memberships: [], isPending, error };
  }

  const memberships = candidates.flatMap((project, index) => {
    const items = resources[index]?.data?.items;
    const resource = items && pipelineResourceIn(items, pointer);
    return resource ? [{ project, resource }] : [];
  });

  return { memberships, isPending, error };
}
