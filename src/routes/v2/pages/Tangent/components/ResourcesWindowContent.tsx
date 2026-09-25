import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddResourceButton } from "@/routes/v2/pages/Tangent/components/AddResourceButton";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  describeResource,
  DOCUMENT,
} from "@/services/projects/resourceDescriptor";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  formatWorkareaTarget,
  idIdentity,
} from "@/services/projects/resourceTarget";
import type { ProjectResourceSummary } from "@/services/projects/types";
import type { LocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { useLocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { getErrorMessage } from "@/utils/string";

import { EditInstructionsDialog } from "./EditInstructionsDialog";
import { WindowListRow } from "./WindowListRow";

interface ProjectResourceItem {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  target?: WorkareaTarget;
}

interface ResourceTypeMeta {
  icon: IconName;
  description: string;
}

const RESOURCE_TYPE_META: Record<string, ResourceTypeMeta> = {
  local_pipeline: { icon: "Workflow", description: "Pipeline" },
  pipeline_run: { icon: "Play", description: "Pipeline run" },
  [DOCUMENT]: { icon: "FileText", description: "Document" },
};

const BACKEND_PIPELINE_META: ResourceTypeMeta = {
  icon: "Workflow",
  description: "Backend pipeline — not supported yet",
};

const ABSENT_PIPELINE_META: ResourceTypeMeta = {
  icon: "Workflow",
  description: "Pipeline — not in this browser",
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
 * A row with no target is listed but cannot be opened. Two kinds land there: a
 * pipeline the backend holds, which nothing here can open because the editor
 * reads browser storage; and a pipeline held in a browser that is not this one,
 * which is the ordinary case in a project someone shared. Both belong to the
 * project, so leaving them out would make the list look wrong.
 */
function toResourceItem(
  resource: ProjectResourceSummary,
  { unavailable, currentNames }: LocalPipelineStatus,
): ProjectResourceItem | undefined {
  if (resource.entity === "pipeline") {
    return resource.entityId
      ? {
          id: resource.id,
          name: resource.name ?? resource.entityId,
          ...BACKEND_PIPELINE_META,
        }
      : undefined;
  }

  const described = describeResource(resource);
  const meta = described && RESOURCE_TYPE_META[described.type];
  const target =
    described && meta
      ? targetOf(resource, described.type, described.target)
      : undefined;
  if (!target || !meta) return undefined;

  // What the pipeline is called now, falling back to the name the row recorded
  // when it was added — which is all there is to go on once it is out of reach.
  const name =
    currentNames.get(resource.id) ??
    resource.name ??
    formatWorkareaTarget(target);

  if (unavailable.has(resource.id)) {
    return { id: resource.id, name, ...ABSENT_PIPELINE_META };
  }

  return {
    id: resource.id,
    name,
    target,
    icon: meta.icon,
    description: meta.description,
  };
}

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { data: resourcesPage } = useProjectResources(store.projectId, {
    entity: ["document", "pipeline"],
  });
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);

  const items = resourcesPage?.items ?? [];
  const localPipelines = useLocalPipelineStatus(items);

  const resources: ProjectResourceItem[] = items.flatMap(
    (resource) => toResourceItem(resource, localPipelines) ?? [],
  );

  async function handleOpenResource(resource: ProjectResourceItem) {
    if (!resource.target) return;
    try {
      await store.openWorkareaTarget(resource.target, resource.name);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  return (
    <BlockStack gap="4" className="p-2">
      <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
        <InstructionsRow projectId={store.projectId} />
        {resources.map((resource) => (
          <WindowListRow
            key={resource.id}
            icon={resource.icon}
            title={resource.name}
            description={resource.description}
            disabled={!resource.target}
            testId={`open-resource-${resource.id}`}
            onOpen={() => void handleOpenResource(resource)}
            action={
              <Button
                variant="ghost"
                size="min"
                className="mr-1 mt-2 shrink-0"
                aria-label={`Remove ${resource.name}`}
                title="Remove"
                disabled={isDetachingResource}
                onClick={() => deleteResource(resource.id)}
              >
                <Icon name="X" size="xs" />
              </Button>
            }
          />
        ))}
      </BlockStack>

      <AddResourceButton projectId={store.projectId} />
    </BlockStack>
  );
}

function InstructionsRow({ projectId }: { projectId: string }) {
  const { instructions, isSaving, save } = useProjectInstructions(projectId);
  const { open } = useDialog();

  async function handleEditInstructions() {
    const result = await open<string, { currentInstructions: string }>({
      component: EditInstructionsDialog,
      props: { currentInstructions: instructions },
      routeKey: "edit-instructions",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    save(result);
  }

  return (
    <WindowListRow
      icon="FileText"
      title={instructions ? "Instructions" : "No instructions yet"}
      titleSubdued={!instructions}
      description="Standing context for agents"
      disabled={isSaving}
      testId="edit-instructions"
      onOpen={() => void handleEditInstructions()}
    />
  );
}
