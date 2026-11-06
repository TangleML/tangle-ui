import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/list-item";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { AddResourceButton } from "@/routes/v2/pages/Tangent/components/AddResourceButton";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  type ProjectResourceItem,
  useProjectResourceItems,
} from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { useDismissProjectCard } from "./projectCardContext";

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const dismissCard = useDismissProjectCard();
  const notify = useToastNotification();
  const { isLoading, isLoaded, error, summaries, resources } =
    useProjectResourceItems(store.projectId);
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);

  async function handleOpenResource(resource: ProjectResourceItem) {
    if (!resource.target) return;
    dismissCard();
    try {
      await store.openWorkareaTarget(resource.target, resource.name);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  return (
    <BlockStack gap="4" className="p-2">
      <BlockStack as="ul" gap="1">
        {resources.map((resource) => (
          <ListItem
            key={resource.id}
            icon={resource.icon}
            title={resource.name}
            subtitle={resource.description}
            disabled={!resource.target}
            testId={`open-resource-${resource.id}`}
            onOpen={() => void handleOpenResource(resource)}
            tracking={tracking("projects.open_from_details_panel")}
            actions={[
              {
                icon: "X",
                label: `Remove ${resource.name}`,
                disabled: isDetachingResource,
                onClick: () => deleteResource(resource.id),
                tracking: tracking("projects.remove_resource_open"),
              },
            ]}
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

      {isLoaded && resources.length === 0 && (
        <Text size="sm" tone="subdued">
          Nothing is attached to this project yet
        </Text>
      )}

      <AddResourceButton projectId={store.projectId} resources={summaries} />
    </BlockStack>
  );
}
