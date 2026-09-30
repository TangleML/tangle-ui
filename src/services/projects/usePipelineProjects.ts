import { useQueries, useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { pointerTo } from "@/services/localPipelines/localPipelinesService";
import { LocalPipelinesQueryKeys } from "@/services/localPipelines/types";
import { MINUTES } from "@/utils/constants";

import { holdsPipeline, PIPELINE_RESOURCE_PARAMS } from "./pipelineProjects";
import { listProjectResources } from "./projectResourcesService";
import type { ProjectSummary } from "./types";
import { ProjectResourcesQueryKeys } from "./types";
import { useProjects } from "./useProjects";

/**
 * Which of the reader's projects hold a given pipeline. There is no asking the
 * backend that question — no endpoint answers it and resources cannot be
 * filtered by what they point at — so it is one resource listing per project,
 * read through the same query the project page uses so that adding a pipeline
 * to a project is already reflected here.
 *
 * Only the first page of projects, and of each project's resources, is
 * consulted.
 */
export function usePipelineProjects(pipelineName: string | undefined) {
  const { configured, available } = useBackend();
  const enabled = configured && available && Boolean(pipelineName);

  const { data: pointer } = useQuery({
    queryKey: LocalPipelinesQueryKeys.Pointer({
      localName: pipelineName ?? "",
    }),
    queryFn: () => pointerTo(pipelineName ?? ""),
    enabled,
    staleTime: 1 * MINUTES,
  });

  const { data: projects } = useProjects({});

  const candidates: ProjectSummary[] = enabled ? (projects?.items ?? []) : [];

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

  if (!pointer) {
    return [];
  }

  return candidates.filter((_project, index) => {
    const items = resources[index]?.data?.items;
    return items !== undefined && holdsPipeline(items, pointer);
  });
}
