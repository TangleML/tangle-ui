/** @public */
export type ProjectOrigin = "user" | "agent";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  origin: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  resourceCounts: Record<string, number>;
}

/**
 * The single read returns exactly what the list does. Kept as its own name so
 * the distinction the API draws survives a field being added back to one and
 * not the other.
 */
export type Project = ProjectSummary;

export interface ProjectPage {
  items: ProjectSummary[];
  nextPageToken: string | null;
  totalCount: number;
}

export interface ListProjectsParams {
  workspaceId?: string;
  createdBy?: string;
  pageToken?: string;
  pageSize?: number;
}

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  description?: string | null;
  origin?: ProjectOrigin;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProjectInput {
  name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DeleteProjectResult {
  id: string;
  deletedResourceCounts: Record<string, number>;
  deletedResourceTotal: number;
}

/** @public */
export type ProjectResourceEntity = "pipeline" | "agent_session" | "document";

export interface ProjectResourceSummary {
  id: string;
  projectId: string;
  entity: string;
  name: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectResource extends ProjectResourceSummary {
  payload: Record<string, unknown> | null;
}

export interface ProjectResourcePage {
  items: ProjectResourceSummary[];
  nextPageToken: string | null;
  totalCount: number;
}

export interface ProjectRun {
  id: string;
  rootExecutionId: string;
  pipelineName: string | null;
  createdBy: string | null;
  createdAt: Date | null;
}

export interface ProjectRunPage {
  items: ProjectRun[];
  nextPageToken: string | null;
}

export interface ListProjectRunsParams {
  pageToken?: string;
  since?: string;
  until?: string;
}

export interface ListProjectResourcesParams {
  entity?: ProjectResourceEntity[];
  pageToken?: string;
  pageSize?: number;
}

export interface CreateResourceInput {
  entity: ProjectResourceEntity;
  name?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateResourceInput {
  name?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export const WorkspacesQueryKeys = {
  All: () => ["workspaces"] as const,
  Id: (id: string) => ["workspaces", id] as const,
} as const;

export const ProjectsQueryKeys = {
  All: () => ["projects"] as const,
  Id: (id: string) => ["projects", id] as const,
  List: (params: ListProjectsParams = {}) =>
    ["projects", "list", params] as const,
} as const;

export const ProjectResourcesQueryKeys = {
  All: (projectId: string) => ["projects", projectId, "resources"] as const,
  Id: (projectId: string, resourceId: string) =>
    ["projects", projectId, "resources", resourceId] as const,
  Lists: (projectId: string) =>
    ["projects", projectId, "resources", "list"] as const,
  List: (projectId: string, params: ListProjectResourcesParams = {}) =>
    ["projects", projectId, "resources", "list", params] as const,
} as const;

export const ProjectRunsQueryKeys = {
  All: (projectId: string) => ["projects", projectId, "runs"] as const,
  List: (projectId: string, params: ListProjectRunsParams = {}) =>
    ["projects", projectId, "runs", "list", params] as const,
  Stats: (runId: string) => ["pipeline-run-stats", runId] as const,
} as const;
