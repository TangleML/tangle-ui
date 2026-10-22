import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";

import { removeSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { SecretsQueryKeys } from "../types";

interface RemoveSecretButtonProps {
  secret: Pick<Secret, "id" | "name">;
  teamId?: string;
  onSuccess?: () => void;
}

export function RemoveSecretButton({
  secret,
  teamId,
  onSuccess,
}: RemoveSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: removeSecretMutation, isPending } = useMutation({
    mutationFn: () => removeSecret(secret.id, teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SecretsQueryKeys.All(teamId),
      });
      onSuccess?.();
    },
    onError: (error) => {
      notify(error.message, "error");
    },
  });

  return (
    <ConfirmationDialog
      trigger={
        <Button
          variant="ghost"
          size="xs"
          disabled={isPending}
          aria-label={`Delete ${secret.name}`}
          className="text-destructive hover:text-destructive"
          data-testid="secret-remove-button"
        >
          <Icon name="Trash" size="sm" />
        </Button>
      }
      title={`Delete "${secret.name}"?`}
      description="Runs that use it will fail when they start. This can't be undone."
      onConfirm={() => removeSecretMutation()}
    />
  );
}
