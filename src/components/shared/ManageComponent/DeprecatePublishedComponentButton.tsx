import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import ConfirmationDialog from "../Dialogs/ConfirmationDialog";
import { InfoBox } from "../InfoBox";
import { ComponentQualityCard } from "./ComponentQualityCard";

/**
 * Delete a published component.
 * If a successor component is provided, it will be published instead of deprecated.
 *
 * @param predecessorComponent - The component to delete (deprecate).
 * @param successorComponent - The component to publish instead of deprecated.
 * @param onSuccess - Callback function to be called when the mutation is successful.
 * @returns A button to delete the component.
 */
export const DeprecatePublishedComponentButton = ({
  predecessorComponent,
  successorComponent,
  onSuccess,
}: {
  predecessorComponent: HydratedComponentReference;
  successorComponent?: HydratedComponentReference;
  onSuccess?: () => void;
}) => {
  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();
  const { getComponentLibrary } = useComponentLibrary();
  const publishedComponentsLibrary = getComponentLibrary(
    "published_components",
  );
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  // strings and content for the confirmation dialog
  const { title, description, content, successMessage, buttonLabel } =
    successorComponent
      ? {
          buttonLabel: "Release new version",
          title: predecessorComponent.name,
          description:
            "Are you sure you want to release a new version of this component?",
          successMessage: "Component updated successfully",
          content: (
            <BlockStack gap="1">
              <Text as="p" size="xs" tone="subdued">
                This will create a new version of the component with the same
                name. The previous version will be marked as deprecated. In
                search results, the new version will be listed. Users who have
                already used the previous version will still be able to use it
                or upgrade to the new version.
              </Text>
              <ComponentQualityCard component={successorComponent} />
            </BlockStack>
          ),
        }
      : {
          buttonLabel: "Deprecate component",
          title: predecessorComponent.name,
          description: "Are you sure you want to deprecate this component?",
          successMessage: "Component deprecated successfully",
          content: (
            <Text as="p" size="sm">
              This will deprecate the component and it will no longer be
              available in search results. The component will still be available
              in the component library for users who have already used it.
            </Text>
          ),
        };

  const {
    mutate: deletePublishedComponent,
    isPending,
    isError,
    error,
  } = useMutation({
    mutationFn: async () => {
      await publishedComponentsLibrary.removeComponent(predecessorComponent, {
        supersedeBy: successorComponent,
      });
    },
    onSuccess: () => {
      notify(successMessage, "success");
      if (successorComponent) {
        queryClient.invalidateQueries({
          queryKey: [
            "component-library",
            "published",
            "has",
            successorComponent.digest,
          ],
        });
      }
      onSuccess?.();
    },
    onError: (error) => {
      notify(`Failed to update component: ${error.message}`, "error");
    },
  });

  const confirmProcess = async () => {
    const confirmed = await triggerConfirmation({
      title,
      description,
      content,
    });

    if (confirmed) {
      deletePublishedComponent();
    }
  };

  return (
    <>
      <Button disabled={isPending} onClick={confirmProcess} size="xs">
        {buttonLabel} {isPending ? <Spinner /> : null}
      </Button>
      {isError && (
        <InfoBox title="Error" variant="error">
          {error.message}
        </InfoBox>
      )}
      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
    </>
  );
};
