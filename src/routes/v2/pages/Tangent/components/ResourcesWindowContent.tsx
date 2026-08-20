import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddPipelineDialog } from "@/routes/v2/pages/Tangent/components/AddPipelineDialog";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type {
  TangentResourceInput,
  TangentResourceType,
} from "@/services/tangentStorage/types";

const RESOURCE_ICONS: Record<TangentResourceType, IconName> = {
  run: "Play",
  pipeline: "Workflow",
};

export function ResourcesWindowContent() {
  const { resources, attachResource, detachResource } = useTangentProject();
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

  return (
    <BlockStack gap="2" className="p-2">
      <InlineStack align="space-between" blockAlign="center">
        <Text size="xs" weight="semibold" tone="subdued">
          Pipelines
        </Text>
      </InlineStack>

      <Button variant="outline" size="sm" onClick={handleAddPipeline}>
        <Icon name="Plus" size="xs" />
        Add a pipeline
      </Button>

      {resources.length === 0 ? (
        <Text size="xs" tone="subdued">
          No pipelines attached yet.
        </Text>
      ) : (
        <BlockStack gap="1">
          {resources.map((resource) => (
            <InlineStack
              key={resource.id}
              gap="2"
              blockAlign="center"
              wrap="nowrap"
              className="rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Icon name={RESOURCE_ICONS[resource.type]} size="xs" />
              <BlockStack className="min-w-0 flex-1">
                <Text size="sm" className="truncate">
                  {resource.name}
                </Text>
                {resource.description ? (
                  <Text size="xs" tone="subdued" className="truncate">
                    {resource.description}
                  </Text>
                ) : null}
              </BlockStack>
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
    </BlockStack>
  );
}
