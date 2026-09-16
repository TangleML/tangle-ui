import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddPipelineDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import {
  type AttachResourceInput,
  type ProjectResourceItem,
  type ProjectResourceKind,
  useTangentProject,
} from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { getErrorMessage } from "@/utils/string";

import { EditInstructionsDialog } from "./EditInstructionsDialog";

const RESOURCE_ICONS: Record<ProjectResourceKind, IconName> = {
  pipeline: "Workflow",
};

export function ResourcesWindowContent() {
  const {
    resources,
    attachResource,
    isAttachingResource,
    detachResource,
    isDetachingResource,
    openWorkareaTarget,
    onError,
  } = useTangentProject();
  const { open } = useDialog();

  async function handleAddPipeline() {
    const result = await open<AttachResourceInput>({
      component: AddPipelineDialog,
      routeKey: "add-pipeline",
      size: "full",
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;
    attachResource(result);
  }

  async function handleOpenResource(resource: ProjectResourceItem) {
    try {
      await openWorkareaTarget(resource.target, resource.name);
    } catch (error) {
      onError(getErrorMessage(error));
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
                    onClick={() => detachResource(resource.id)}
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

        <InstructionsBlock />
      </BlockStack>
    </BlockStack>
  );
}

function InstructionsBlock() {
  const { instructions, setInstructions, isSavingInstructions } =
    useTangentProject();
  const { open } = useDialog();

  async function handleEditInstructions() {
    const result = await open<string, { currentInstructions: string }>({
      component: EditInstructionsDialog,
      props: { currentInstructions: instructions },
      routeKey: "edit-instructions",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    setInstructions(result);
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
