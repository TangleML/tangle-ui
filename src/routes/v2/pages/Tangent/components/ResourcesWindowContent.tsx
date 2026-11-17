import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/list-item";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { AddResourceButton } from "@/routes/v2/pages/Tangent/components/AddResourceButton";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  type ProjectResourceItem,
  useProjectResourceItems,
} from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { EditInstructionsDialog } from "./EditInstructionsDialog";

export function ResourcesWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { isLoading, isLoaded, error, summaries, resources } =
    useProjectResourceItems(store.projectId);
  const { mutate: deleteResource, isPending: isDetachingResource } =
    useDeleteProjectResource(store.projectId);

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
      <BlockStack as="ul" gap="1">
        <InstructionsRow projectId={store.projectId} />
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
    <ListItem
      icon="FileText"
      title={knownEmpty ? "No instructions yet" : "Instructions"}
      placeholder={knownEmpty}
      subtitle="Standing context for agents"
      disabled={isPending || isSaving}
      testId="edit-instructions"
      onOpen={() => void handleEditInstructions()}
      tracking={tracking("projects.edit_instructions_open")}
    />
  );
}
