import { useMutation } from "@tanstack/react-query";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { deleteGithubLibrary } from "../utils/deleteGithubLibrary";

export const DeleteLibraryButton = withSuspenseWrapper(
  ({ library }: { library: StoredLibrary }) => {
    const notify = useToastNotification();
    const {
      handlers: confirmationHandlers,
      triggerDialog: triggerConfirmation,
      ...confirmationProps
    } = useConfirmationDialog();

    const { mutate: unlinkLibrary, isPending } = useMutation({
      mutationFn: async () => {
        const confirmed = await triggerConfirmation({
          title: "Unlink Library",
          description: `Are you sure you want to unlink "${library.name}"?`,
          content: (
            <Text tone="subdued">
              Your components will still be available in the Pipeline.
            </Text>
          ),
        });

        if (!confirmed) return false;

        await deleteGithubLibrary(library);

        return true;
      },
      onSuccess: (deleted) => {
        if (!deleted) return;

        notify("Library unlinked successfully", "success");
      },
      onError: (error) => {
        notify(`Failed to unlink library: ${error.message}`, "error");
      },
    });

    return (
      <>
        <Button
          variant="destructiveOnHover"
          size="sm"
          onClick={() => unlinkLibrary()}
          disabled={isPending}
        >
          {isPending ? <Spinner /> : <Icon name="Unlink" />}
        </Button>
        <ConfirmationDialog
          {...confirmationProps}
          onConfirm={() => confirmationHandlers?.onConfirm()}
          onCancel={() => confirmationHandlers?.onCancel()}
        />
      </>
    );
  },
);
