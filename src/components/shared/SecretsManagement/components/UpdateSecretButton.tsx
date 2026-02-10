import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";

import { SecretsQueryKeys, updateSecret } from "../secretsStorage";
import type { Secret } from "../types";

interface UpdateSecretButtonProps {
  secret: Pick<Secret, "id" | "value">;
  disabled?: boolean;
  onSuccess: () => void;
}

export function UpdateSecretButton({
  secret,
  disabled,
  onSuccess,
}: UpdateSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: updateSecretMutation, isPending } = useMutation({
    mutationFn: () => updateSecret(secret.id, { value: secret.value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SecretsQueryKeys.All() });
      onSuccess();
    },
    onError: () => {
      notify("Failed to update secret", "error");
    },
  });

  return (
    <Button
      onClick={() => updateSecretMutation()}
      disabled={disabled || isPending}
    >
      Update Secret
      {isPending && <Spinner />}
    </Button>
  );
}
