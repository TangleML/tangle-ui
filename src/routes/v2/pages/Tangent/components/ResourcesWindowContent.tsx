import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import {
  AddPipelineDialog,
  type AttachResourceInput,
  type ProjectResourceKind,
} from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";
import {
  formatWorkareaTarget,
  idIdentity,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResources,
} from "@/services/projects/useProjectResources";
import { useProject, useUpdateProject } from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

import { EditInstructionsDialog } from "./EditInstructionsDialog";

interface ProjectResourceItem {
  id: string;
  name: string;
  entity: ProjectResourceKind;
  target: WorkareaTarget;
}

const RESOURCE_ICONS: Record<ProjectResourceKind, IconName> = {
  pipeline: "Workflow",
};

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { data: resourcesPage } = useProjectResources(store.projectId);
  const { mutate: createResource, isPending: isAttachingResource } =
    useCreateProjectResource(store.projectId);
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);
  const { open } = useDialog();

  const resources: ProjectResourceItem[] = (resourcesPage?.items ?? []).flatMap(
    (resource) => {
      if (resource.entity !== "pipeline") return [];
      if (!resource.entityId) return [];
      const target: WorkareaTarget = {
        type: "pipeline",
        identity: idIdentity(resource.entityId),
      };
      return [
        {
          id: resource.id,
          name: resource.name ?? formatWorkareaTarget(target),
          entity: resource.entity,
          target,
        },
      ];
    },
  );

  async function handleAddPipeline() {
    const result = await open<AttachResourceInput>({
      component: AddPipelineDialog,
      routeKey: "add-pipeline",
      size: "full",
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;
    createResource(result);
  }

  async function handleOpenResource(resource: ProjectResourceItem) {
    try {
      await store.openWorkareaTarget(resource.target, resource.name);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  return (
    <BlockStack gap="4" className="p-2">
      <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
        <ContentBlock
          title="Pipelines"
          collapsible
          defaultOpen
          className="px-2 py-1"
        >
          {resources.length === 0 ? (
            <Text size="xs" tone="subdued">
              No pipelines attached yet.
            </Text>
          ) : (
            <BlockStack gap="2">
              {resources.map((resource) => (
                <InlineStack
                  key={resource.id}
                  gap="1"
                  blockAlign="center"
                  wrap="nowrap"
                  className="truncate rounded-md hover:bg-accent w-full"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`open-resource-${resource.id}`}
                    className="h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-1.5 truncate"
                    title={`Open ${resource.name}`}
                    onClick={() => void handleOpenResource(resource)}
                  >
                    <Icon name={RESOURCE_ICONS[resource.entity]} size="xs" />
                    <Text size="sm" className="truncate">
                      {resource.name}
                    </Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="min"
                    aria-label={`Remove ${resource.name}`}
                    title="Remove"
                    disabled={isDetachingResource}
                    onClick={() => deleteResource(resource.id)}
                  >
                    <Icon name="X" size="xs" />
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          )}
          <Button
            variant="outline"
            className="w-full"
            disabled={isAttachingResource}
            onClick={() => void handleAddPipeline()}
          >
            <Icon name="Plus" size="xs" />
            Add a pipeline
          </Button>
        </ContentBlock>

        <InstructionsBlock projectId={store.projectId} />
      </BlockStack>
    </BlockStack>
  );
}

function InstructionsBlock({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { mutate: updateProject, isPending: isSavingInstructions } =
    useUpdateProject();
  const { open } = useDialog();

  const instructions = project?.notes ?? "";

  async function handleEditInstructions() {
    const result = await open<string, { currentInstructions: string }>({
      component: EditInstructionsDialog,
      props: { currentInstructions: instructions },
      routeKey: "edit-instructions",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    updateProject({ id: projectId, input: { notes: result } });
  }

  return (
    <ContentBlock
      title="Instructions"
      collapsible
      defaultOpen
      className="px-2 py-1"
    >
      <Button
        variant="outline"
        className="w-full"
        disabled={isSavingInstructions}
        onClick={() => void handleEditInstructions()}
      >
        <Icon name="Pencil" size="xs" />
        Edit instructions
      </Button>
    </ContentBlock>
  );
}
