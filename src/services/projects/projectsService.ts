import {
  createProjectApiProjectsPost,
  deleteProjectApiProjectsProjectIdDelete,
  getProjectApiProjectsProjectIdGet,
  listProjectsApiProjectsGet,
  updateProjectApiProjectsProjectIdPatch,
} from "@/api/sdk.gen";

import { ProjectsApiError } from "./errors";
import { mapDeleteResult, mapProject, mapProjectSummary } from "./mappers";
import type {
  CreateProjectInput,
  DeleteProjectResult,
  ListProjectsParams,
  Project,
  ProjectPage,
  UpdateProjectInput,
} from "./types";

export async function listProjects(
  params: ListProjectsParams = {},
): Promise<ProjectPage> {
  const result = await listProjectsApiProjectsGet({
    query: {
      workspace_id: params.workspaceId,
      created_by: params.createdBy,
      page_token: params.pageToken,
      page_size: params.pageSize,
    },
  });
  if (!result.data) {
    throw new ProjectsApiError(
      "Failed to list projects",
      result.response.status,
    );
  }
  return {
    items: result.data.projects.map(mapProjectSummary),
    nextPageToken: result.data.next_page_token ?? null,
    totalCount: result.data.total_count,
  };
}

export async function getProject(id: string): Promise<Project> {
  const result = await getProjectApiProjectsProjectIdGet({
    path: { project_id: id },
  });
  if (!result.data) {
    throw new ProjectsApiError(
      `Failed to fetch project ${id}`,
      result.response.status,
    );
  }
  return mapProject(result.data);
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const result = await createProjectApiProjectsPost({
    body: {
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description,
      notes: input.notes,
      origin: input.origin,
      extra_data: input.extraData,
    },
  });
  if (!result.data) {
    throw new ProjectsApiError(
      "Failed to create project",
      result.response.status,
    );
  }
  return mapProject(result.data);
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const result = await updateProjectApiProjectsProjectIdPatch({
    path: { project_id: id },
    body: {
      name: input.name,
      description: input.description,
      notes: input.notes,
      extra_data: input.extraData,
    },
  });
  if (!result.data) {
    throw new ProjectsApiError(
      `Failed to update project ${id}`,
      result.response.status,
    );
  }
  return mapProject(result.data);
}

export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  const result = await deleteProjectApiProjectsProjectIdDelete({
    path: { project_id: id },
  });
  if (!result.data) {
    throw new ProjectsApiError(
      `Failed to delete project ${id}`,
      result.response.status,
    );
  }
  return mapDeleteResult(result.data);
}
