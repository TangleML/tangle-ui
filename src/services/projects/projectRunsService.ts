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
