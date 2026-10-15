import type { ComponentProps } from "react";

import type ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { WorkspaceSecret } from "@/services/projects/types";
import { useDeleteWorkspaceSecret } from "@/services/projects/useWorkspaceSecrets";

import { SECRET_MUTATED_EVENT } from "./workspaceSecretEvents";

interface DeleteWorkspaceSecretAction {
  confirmAndDelete: (secret: WorkspaceSecret) => Promise<void>;
  isDeleting: boolean;
  confirmation: ComponentProps<typeof ConfirmationDialog>;
}

export function useDeleteWorkspaceSecretAction(
  workspaceId: string,
): DeleteWorkspaceSecretAction {
  const deleteSecret = useDeleteWorkspaceSecret(workspaceId);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { handlers, triggerDialog, ...confirmationProps } =
    useConfirmationDialog();

  const confirmAndDelete = async (secret: WorkspaceSecret) => {
    const confirmed = await triggerDialog({
      title: `Delete "${secret.name}"?`,
      description:
        "Runs in this workspace that use it will fail when they start.",
    });
    if (!confirmed) return;

    deleteSecret.mutate(secret.name, {
      onSuccess: () => {
        track(SECRET_MUTATED_EVENT, { action: "deleted" });
        notify("Secret deleted", "success");
      },
    });
  };

  return {
    confirmAndDelete,
    isDeleting: deleteSecret.isPending,
    confirmation: {
      ...confirmationProps,
      onConfirm: () => handlers?.onConfirm(),
      onCancel: () => handlers?.onCancel(),
    },
  };
}
