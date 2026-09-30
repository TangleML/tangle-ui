import type { IconName } from "@/components/ui/icon";

export type ResourceConcept = "pipeline" | "run" | "document" | "session";

interface ResourceMeta {
  icon: IconName;
  label: string;
}

/**
 * What each thing a project holds looks like, read by the project page and the
 * Tangent windows alike so one thing is never drawn two ways.
 *
 * A session is deliberately not `Bot`: that is Tangent's own mark in the
 * sidebar, and a row wearing it reads as the product rather than as one
 * conversation inside it.
 */
const RESOURCE_META: Record<ResourceConcept, ResourceMeta> = {
  pipeline: { icon: "GitBranch", label: "Pipeline" },
  run: { icon: "Play", label: "Pipeline run" },
  document: { icon: "FileText", label: "Document" },
  session: { icon: "MessageSquare", label: "Session" },
};

export const resourceMeta = (concept: ResourceConcept): ResourceMeta =>
  RESOURCE_META[concept];

const ENTITY_CONCEPTS: Record<string, ResourceConcept> = {
  pipeline: "pipeline",
  agent_session: "session",
  document: "document",
};

export const conceptForEntity = (entity: string): ResourceConcept | undefined =>
  ENTITY_CONCEPTS[entity];
