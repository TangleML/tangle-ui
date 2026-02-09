import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";

import { removeSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { SecretsQueryKeys } from "../types";

interface RemoveSecretButtonProps {
  secret: Pick<Secret, "id">;
  onSuccess?: () => void;
}

export function RemoveSecretButton({
  secret,
  onSuccess,
}: RemoveSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: removeSecretMutation, isPending } = useMutation({
    mutationFn: () => removeSecret(secret.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SecretsQueryKeys.All() });
      onSuccess?.();
    },
    onError: () => {
      notify("Failed to remove secret", "error");
    },
  });

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => removeSecretMutation()}
      disabled={isPending}
      className="text-destructive hover:text-destructive"
    >
      <Icon name="Trash2" size="sm" />
    </Button>
  );
}
