import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";

import { addSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { SecretsQueryKeys } from "../types";

interface AddSecretButtonProps {
  secret: Pick<Secret, "name" | "value">;
  disabled?: boolean;
  onSuccess: () => void;
}

export function AddSecretButton({
  secret,
  disabled,
  onSuccess,
}: AddSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { mutate: saveSecret, isPending } = useMutation({
    mutationFn: () => addSecret(secret),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SecretsQueryKeys.All() });
      onSuccess();
    },
    onError: () => {
      notify("Failed to add secret", "error");
    },
  });

  return (
    <Button onClick={() => saveSecret()} disabled={disabled || isPending}>
      Add Secret
      {isPending && <Spinner />}
    </Button>
  );
}
