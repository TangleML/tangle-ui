import { client } from "@/api/client.gen";

import { ProjectRunsApiError } from "./errors";
import type {
  ListProjectRunsParams,
  ProjectRun,
  ProjectRunPage,
} from "./types";

/**
 * `GET /api/projects/{id}/runs` is absent from the generated client, whose
 * checked-in copy predates the endpoint. Regenerating would replace the whole
 * client from whatever backend happens to be running, so this one call is
 * written out by hand; `client` still supplies the base url and headers that
 * `BackendProvider` configures, so it behaves like any generated call.
 */
interface ProjectRunDto {
  id: string;
  root_execution_id: string;
  created_by: string | null;
  created_at: string;
  pipeline_name: string | null;
}

interface ProjectRunListDto {
  runs: ProjectRunDto[];
  next_page_token?: string | null;
}

function mapProjectRun(dto: ProjectRunDto): ProjectRun {
  return {
    id: dto.id,
    rootExecutionId: dto.root_execution_id,
    pipelineName: dto.pipeline_name,
    createdBy: dto.created_by,
    createdAt: new Date(dto.created_at),
  };
}

/**
 * A project's run feed carries no execution stats, and `include_execution_stats`
 * is the only way to get them out of `/api/pipeline_runs/{id}` — the shared
 * `fetchPipelineRun` omits it, and adding it there would change the payload
 * every other caller caches. So the project page asks for its own.
 */
export async function getRunExecutionStats(
  runId: string,
): Promise<Record<string, number> | null> {
  const result = await client.get<{
    200: { execution_status_stats?: Record<string, number> | null };
  }>({
    url: "/api/pipeline_runs/{id}",
    path: { id: runId },
    query: { include_execution_stats: true },
  });

  if (!result.data) {
    throw new ProjectRunsApiError(
      `Failed to fetch run ${runId}`,
      result.response.status,
    );
  }

  return result.data.execution_status_stats ?? null;
}

export async function listProjectRuns(
  projectId: string,
  params: ListProjectRunsParams = {},
): Promise<ProjectRunPage> {
  const result = await client.get<{ 200: ProjectRunListDto }>({
    url: "/api/projects/{project_id}/runs",
    path: { project_id: projectId },
    query: {
      page_token: params.pageToken,
      since: params.since,
      until: params.until,
    },
  });

  if (!result.data) {
    throw new ProjectRunsApiError(
      `Failed to list runs for project ${projectId}`,
      result.response.status,
    );
  }

  return {
    items: result.data.runs.map(mapProjectRun),
    nextPageToken: result.data.next_page_token ?? null,
  };
}
