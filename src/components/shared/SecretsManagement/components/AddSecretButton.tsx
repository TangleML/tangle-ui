import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";

import { addSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { SecretsQueryKeys } from "../types";

interface AddSecretButtonProps {
  secret: Pick<Secret, "name" | "value" | "description" | "expiresAt">;
  teamId?: string;
  disabled?: boolean;
  onSuccess: () => void;
}

export function AddSecretButton({
  secret,
  teamId,
  disabled,
  onSuccess,
}: AddSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: saveSecret, isPending } = useMutation({
    mutationFn: () => addSecret(secret, teamId),
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
      onClick={() => saveSecret()}
      disabled={disabled || isPending}
      data-testid="add-secret-submit-button"
    >
      Add Secret
      {isPending && <Spinner />}
    </Button>
  );
}
