import type { ProjectResource } from "./tangleRestClient.ts";

export interface ResourceKind {
  label: string;
  icon: string;
}

type ResourceRow = Pick<ProjectResource, "entity" | "metadata">;

const PIPELINE: ResourceKind = { label: "Pipeline", icon: "type-hierarchy" };

// Must match the `data.type` values the web app writes in
// src/services/projects/resourceDescriptor.ts; the row's entity is the fallback.
const KINDS: Record<string, ResourceKind> = {
  pipeline: PIPELINE,
  local_pipeline: PIPELINE,
  pipeline_run: { label: "Run", icon: "play-circle" },
  instructions: { label: "Instructions", icon: "book" },
  document: { label: "Document", icon: "file-text" },
  agent_session: { label: "Session", icon: "comment-discussion" },
};

const UNKNOWN_KIND: ResourceKind = { label: "Resource", icon: "file" };

const WORKAREA_TARGET = /^(run|pipeline):\/\/(id|name)\/(.+)$/;

function metadataString(
  resource: ResourceRow,
  key: string,
): string | undefined {
  const value = resource.metadata?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function resourceKind(resource: ResourceRow): ResourceKind {
  const type = metadataString(resource, "type");
  return (type && KINDS[type]) || KINDS[resource.entity] || UNKNOWN_KIND;
}

/**
 * Where the web app shows a resource: the run or pipeline its row points at,
 * otherwise the project page that lists it.
 */
export function resourceWebPath(
  projectId: string,
  resource: ResourceRow,
): string {
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const match = WORKAREA_TARGET.exec(
    metadataString(resource, "identity") ?? "",
  );
  if (!match) return projectPath;
  const [, type, key, value] = match;
  if (type === "run") return `/runs/${encodeURIComponent(value)}`;
  const pipelineName =
    key === "name" ? value : metadataString(resource, "fallbackName");
  return pipelineName
    ? `/editor/${encodeURIComponent(pipelineName)}`
    : projectPath;
}
