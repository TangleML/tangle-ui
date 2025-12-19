import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import ConfirmationDialog from "../Dialogs/ConfirmationDialog";
import { InfoBox } from "../InfoBox";
import { ComponentQualityCard } from "./ComponentQualityCard";

/**
 * Publish a component.
 *
 * @param component - The component to publish.
 * @param onSuccess - Callback function to be called when the mutation is successful.
 * @returns A button to publish the component.
 */
export const PublishComponentButton = ({
  component,
  onSuccess,
}: {
  component: HydratedComponentReference;
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
  const {
    mutate: publishComponent,
    isPending,
    isError,
    error,
  } = useMutation({
    mutationFn: async () => {
      await publishedComponentsLibrary.addComponent(component);
    },
    onSuccess: () => {
      notify("Component published successfully", "success");
      queryClient.invalidateQueries({
        queryKey: ["has-component", component.digest],
      });
      queryClient.invalidateQueries({
        queryKey: ["componentLibrary", "publishedComponents"],
      });
      onSuccess?.();
    },
    onError: (error) => {
      notify(`Failed to publish component: ${error.message}`, "error");
    },
  });

  const confirmationContent = useMemo(
    () => <ComponentQualityCard component={component} />,
    [component],
  );

  const confirmProcess = useCallback(async () => {
    const confirmed = await triggerConfirmation({
      title: "Publish component",
      description: "",
      content: confirmationContent,
    });

    if (confirmed) {
      publishComponent();
    }
  }, [triggerConfirmation, publishComponent, confirmationContent]);

  return (
    <>
      <Button
        disabled={isPending}
        onClick={confirmProcess}
        size="xs"
        data-testid="publish-component-button"
      >
        Publish component {isPending ? <Spinner /> : null}
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
