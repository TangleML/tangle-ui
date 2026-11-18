import type { IconName } from "@/components/ui/icon";
import { remoteResourceTarget } from "@/services/projects/pipelineResource";
import { UNTITLED } from "@/services/projects/placeholderNames";
import {
  describeResource,
  DOCUMENT,
  INSTRUCTIONS,
} from "@/services/projects/resourceDescriptor";
import {
  conceptForDescriptorType,
  resourceMeta,
} from "@/services/projects/resourceMeta";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  formatWorkareaTarget,
  idIdentity,
} from "@/services/projects/resourceTarget";
import type {
  ProjectResourceEntity,
  ProjectResourceSummary,
} from "@/services/projects/types";
import type { LocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { useLocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { useEveryProjectResource } from "@/services/projects/useProjectResources";
import { useRemotePipelineNames } from "@/services/projects/useRemotePipelineNames";

export interface ProjectResourceItem {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  target?: WorkareaTarget;
}

const BACKEND_PIPELINE_META = {
  icon: resourceMeta("pipeline").icon,
  description: resourceMeta("pipeline").label,
};

const ABSENT_PIPELINE_META = {
  icon: resourceMeta("pipeline").icon,
  description: "Pipeline — not in this browser",
};

const OTHER_META = {
  icon: "Box" as IconName,
  description: "Not something this version can open",
};

/**
 * A document carries its own body, so it records no identity — the row is the
 * document, and the row's own id is what addresses it.
 */
function targetOf(
  resource: ProjectResourceSummary,
  type: string,
  recorded: WorkareaTarget | undefined,
): WorkareaTarget | undefined {
  if (type === DOCUMENT) {
    return { type: "document", identity: idIdentity(resource.id) };
  }
  return recorded;
}

/**
 * Remote pipelines open by their backend identity. Local pipelines belonging
 * to another browser remain listed, but cannot be opened here.
 *
 * Instructions are the one row deliberately left out: they have a box of their
 * own above this list, and a second way in would offer a Remove that wipes them.
 */
export function toResourceItem(
  resource: ProjectResourceSummary,
  { unavailable, currentNames }: LocalPipelineStatus,
  remoteNames: ReadonlyMap<string, string>,
): ProjectResourceItem | undefined {
  if (resource.entity === "pipeline") {
    return resource.entityId
      ? {
          id: resource.id,
          name:
            remoteNames.get(resource.id) ?? resource.name ?? resource.entityId,
          ...BACKEND_PIPELINE_META,
          target: remoteResourceTarget(resource),
        }
      : undefined;
  }

  const described = describeResource(resource);
  if (described?.type === INSTRUCTIONS) return undefined;

  // A descriptor is not required of a document, and a document does not need
  // one: the row is the document, so its own id addresses it either way.
  if (!described) {
    const meta = resourceMeta("document");
    return resource.entity === "document"
      ? {
          id: resource.id,
          name: resource.name ?? UNTITLED,
          target: { type: "document", identity: idIdentity(resource.id) },
          icon: meta.icon,
          description: meta.label,
        }
      : { id: resource.id, name: resource.name ?? UNTITLED, ...OTHER_META };
  }

  // A descriptor naming a type this version does not know describes something
  // real that it cannot open, so the row is listed rather than opened wrongly.
  const concept = conceptForDescriptorType(described.type);
  if (!concept) {
    return { id: resource.id, name: resource.name ?? UNTITLED, ...OTHER_META };
  }

  const target = targetOf(resource, described.type, described.target);
  if (!target) return undefined;

  // What the pipeline is called now, falling back to the name the row recorded
  // when it was added — which is all there is to go on once it is out of reach.
  const name =
    currentNames.get(resource.id) ??
    resource.name ??
    formatWorkareaTarget(target);

  if (unavailable.has(resource.id)) {
    return { id: resource.id, name, ...ABSENT_PIPELINE_META };
  }

  const meta = resourceMeta(concept);
  return {
    id: resource.id,
    name,
    target,
    icon: meta.icon,
    description: meta.label,
  };
}

// Attached runs are kept as documents, so this is every kind the card lists.
export const CARD_ENTITIES: ProjectResourceEntity[] = ["document", "pipeline"];

/**
 * The project's pipelines and documents as rows someone can open, named as they
 * are now. Shared by the Resources panel and the empty canvas so both list the
 * same things the same way.
 */
export function useProjectResourceItems(projectId: string) {
  const query = useEveryProjectResource(projectId, CARD_ENTITIES);
  const items = query.data ?? [];
  const localPipelines = useLocalPipelineStatus(items);
  const remotePipelineNames = useRemotePipelineNames(items);

  return {
    isLoading: query.isLoading,
    isLoaded: query.data !== undefined,
    error: query.error,
    summaries: items,
    localPipelines,
    remotePipelineNames,
    resources: items.flatMap(
      (resource) =>
        toResourceItem(resource, localPipelines, remotePipelineNames) ?? [],
    ),
  };
}
