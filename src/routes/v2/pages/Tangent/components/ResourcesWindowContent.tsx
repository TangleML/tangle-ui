import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddResourceButton } from "@/routes/v2/pages/Tangent/components/AddResourceButton";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
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
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";
import {
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { EditInstructionsDialog } from "./EditInstructionsDialog";
import { WindowListRow } from "./WindowListRow";

interface ProjectResourceItem {
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
 * Pipelines open by their backend identity.
 *
 * Instructions are the one row deliberately left out: they have a box of their
 * own above this list, and a second way in would offer a Remove that wipes them.
 */
function toResourceItem(
  resource: ProjectResourceSummary,
): ProjectResourceItem | undefined {
  if (resource.entity === "pipeline") {
    return resource.entityId
      ? {
          id: resource.id,
          name: resource.name ?? resource.entityId,
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

  const name = resource.name ?? formatWorkareaTarget(target);

  const meta = resourceMeta(concept);
  return {
    id: resource.id,
    name,
    target,
    icon: meta.icon,
    description: meta.label,
  };
}

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const {
    data: resourcesPage,
    isLoading,
    error,
  } = useProjectResources(store.projectId, {
    entity: ["document", "pipeline"],
  });
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);

  const items = resourcesPage?.items ?? [];

  const resources: ProjectResourceItem[] = items.flatMap(
    (resource) => toResourceItem(resource) ?? [],
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
      <BlockStack className="border rounded-md divide-y">
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
            {...tracking("projects.open_from_details_panel")}
            action={
              <Button
                variant="ghost"
                size="min"
                className="mr-1 mt-2 shrink-0"
                aria-label={`Remove ${resource.name}`}
                title="Remove"
                disabled={isDetachingResource}
                onClick={() => deleteResource(resource.id)}
                {...tracking("projects.remove_resource_open")}
              >
                <Icon name="X" size="xs" />
              </Button>
            }
          />
        ))}
      </BlockStack>

      {isLoading && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading resources" variant="error">
          {error.message}
        </InfoBox>
      )}

      {resourcesPage && resources.length === 0 && (
        <Text size="sm" tone="subdued">
          Nothing is attached to this project yet
        </Text>
      )}

      <AddResourceButton projectId={store.projectId} resources={items} />
    </BlockStack>
  );
}

function InstructionsRow({ projectId }: { projectId: string }) {
  const { instructions, isPending, isSaving, save } =
    useProjectInstructions(projectId);
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

  // Until the document has loaded there is nothing to say it is empty, and
  // opening it would offer an editor whose save replaces instructions the
  // reader never saw.
  const knownEmpty = !isPending && instructions === "";

  return (
    <WindowListRow
      icon="FileText"
      title={knownEmpty ? "No instructions yet" : "Instructions"}
      titleSubdued={knownEmpty}
      description="Standing context for agents"
      disabled={isPending || isSaving}
      testId="edit-instructions"
      onOpen={() => void handleEditInstructions()}
      {...tracking("projects.edit_instructions_open")}
    />
  );
}
