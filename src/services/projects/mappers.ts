import type {
  DeleteProjectResponse,
  ProjectResourceResponse,
  ProjectResourceSummaryResponse,
  ProjectResponse,
  ProjectSummaryResponse,
  WorkspaceResponse,
} from "@/api/types.gen";

import type {
  DeleteProjectResult,
  Project,
  ProjectResource,
  ProjectResourceSummary,
  ProjectSummary,
  Workspace,
} from "./types";

export function mapWorkspace(dto: WorkspaceResponse): Workspace {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    isActive: dto.is_active,
    extraData: dto.extra_data,
    createdAt: new Date(dto.created_at),
  };
}

export function mapProjectSummary(dto: ProjectSummaryResponse): ProjectSummary {
  return {
    id: dto.id,
    workspaceId: dto.workspace_id,
    name: dto.name,
    description: dto.description,
    createdBy: dto.created_by,
    origin: dto.origin,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
    resourceCounts: dto.resource_counts,
  };
}

export function mapProject(dto: ProjectResponse): Project {
  return {
    ...mapProjectSummary(dto),
    notes: dto.notes,
    extraData: dto.extra_data,
  };
}

export function mapDeleteResult(
  dto: DeleteProjectResponse,
): DeleteProjectResult {
  return {
    id: dto.id,
    deletedResourceCounts: dto.deleted_resource_counts,
    deletedResourceTotal: dto.deleted_resource_total,
  };
}

export function mapProjectResourceSummary(
  dto: ProjectResourceSummaryResponse,
): ProjectResourceSummary {
  return {
    id: dto.id,
    projectId: dto.project_id,
    entity: dto.entity,
    name: dto.name,
    entityId: dto.entity_id,
    extraData: dto.extra_data,
    createdBy: dto.created_by,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}

export function mapProjectResource(
  dto: ProjectResourceResponse,
): ProjectResource {
  return {
    ...mapProjectResourceSummary(dto),
    payload: dto.payload,
  };
}
