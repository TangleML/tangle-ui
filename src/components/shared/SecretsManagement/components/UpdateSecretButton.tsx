import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";

import { updateSecret } from "../secretsStorage";
import { type Secret, SecretsQueryKeys } from "../types";

interface UpdateSecretButtonProps {
  secret: Pick<Secret, "id" | "value" | "description" | "expiresAt">;
  teamId?: string;
  disabled?: boolean;
  onSuccess: () => void;
}

export function UpdateSecretButton({
  secret,
  teamId,
  disabled,
  onSuccess,
}: UpdateSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: updateSecretMutation, isPending } = useMutation({
    mutationFn: () => updateSecret(secret.id, secret, teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SecretsQueryKeys.All(teamId),
      });
      onSuccess();
    },
    onError: (error) => {
      notify(error.message, "error");
    },
  });

  return (
    <Button
      onClick={() => updateSecretMutation()}
      disabled={disabled || isPending}
      data-testid="update-secret-submit-button"
    >
      Update Secret
      {isPending && <Spinner />}
    </Button>
  );
}
