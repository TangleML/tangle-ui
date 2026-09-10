import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddPipelineDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type {
  TangentResource,
  TangentResourceInput,
  TangentResourceType,
} from "@/services/tangentStorage/types";
import { getErrorMessage } from "@/utils/string";

import { EditMemoryDialog } from "./EditMemoryDialog";

const RESOURCE_ICONS: Record<TangentResourceType, IconName> = {
  run: "Play",
  pipeline: "Workflow",
};

export function ResourcesWindowContent() {
  const {
    resources,
    attachResource,
    detachResource,
    openWorkareaTarget,
    onError,
  } = useTangentProject();
  const { open } = useDialog();

  async function handleAddPipeline() {
    const result = await open<TangentResourceInput>({
      component: AddPipelineDialog,
      routeKey: "add-pipeline",
      size: "full",
    }).catch(convertCancelErrorTo(undefined));

    if (!result) return;
    await attachResource(result);
  }

  async function handleOpenResource(resource: TangentResource) {
    try {
      await openWorkareaTarget(resource.url, resource.name);
    } catch (error) {
      onError(getErrorMessage(error));
    }
  }

  return (
    <BlockStack gap="4" className="p-2">
      <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
        <ContentBlock
          title="Pipelines and runs"
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
                    <Icon name={RESOURCE_ICONS[resource.type]} size="xs" />
                    <BlockStack className="min-w-0 flex-1 items-start">
                      <Text size="sm" className="truncate">
                        {resource.name}
                      </Text>
                      {resource.description ? (
                        <Text size="xs" tone="subdued" className="truncate">
                          {resource.description}
                        </Text>
                      ) : null}
                    </BlockStack>
                  </Button>
                  <Button
                    variant="ghost"
                    size="min"
                    aria-label={`Remove ${resource.name}`}
                    title="Remove"
                    onClick={() => void detachResource(resource.id)}
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
            onClick={handleAddPipeline}
          >
            <Icon name="Plus" size="xs" />
            Add a pipeline
          </Button>
        </ContentBlock>

        <MemoryBlock />
      </BlockStack>
    </BlockStack>
  );
}

function MemoryBlock() {
  const { memory, setMemory } = useTangentProject();
  const { open } = useDialog();

  async function handleEditMemory() {
    const result = await open<string, { currentMemory: string }>({
      component: EditMemoryDialog,
      props: { currentMemory: memory },
      routeKey: "edit-memory",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    await setMemory(result);
  }

  return (
    <ContentBlock title="Memory" collapsible defaultOpen className="px-2 py-1">
      <Button variant="outline" className="w-full" onClick={handleEditMemory}>
        <Icon name="Pencil" size="xs" />
        Edit memory
      </Button>
    </ContentBlock>
  );
}
