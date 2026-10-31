import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import type { TeamSummary } from "@/services/teams/types";

import { removeSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { SecretsQueryKeys } from "../types";

interface RemoveSecretButtonProps {
  secret: Pick<Secret, "id" | "name">;
  team?: TeamSummary;
  onSuccess?: () => void;
}

function deletionTitle(secretName: string, team: TeamSummary | undefined) {
  return team
    ? `Delete shared secret "${secretName}"?`
    : `Delete "${secretName}"?`;
}

function deletionConsequence(team: TeamSummary | undefined) {
  if (!team) {
    return "Runs that use it will fail when they start. This can't be undone.";
  }
  return (
    <>
      {"This removes the secret from the "}
      <TeamName team={team} bold />
      {" workspace. Runs that use it will fail. This can't be undone."}
    </>
  );
}

export function RemoveSecretButton({
  secret,
  team,
  onSuccess,
}: RemoveSecretButtonProps) {
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const teamId = team?.id;

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
      title={deletionTitle(secret.name, team)}
      description={deletionConsequence(team)}
      confirmLabel="Delete"
      onConfirm={() => removeSecretMutation()}
    />
  );
}
