import { AddSecretForm } from "@/components/shared/SecretsManagement/components/AddSecretForm";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { TeamSummary } from "@/services/teams/types";

export interface SecretFormDialogProps {
  secret?: Secret;
  team?: TeamSummary;
}

function dialogDescription({ secret, team }: SecretFormDialogProps): string {
  if (secret) return "Runs that start after this use the new value.";
  if (team) return `Everyone in ${team.label} can use it in this project.`;
  return "Only runs you submit can use it.";
}

export function SecretFormDialog({
  close,
  cancel,
  secret,
  team,
}: DialogProps<void, SecretFormDialogProps>) {
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const handleSuccess = () => {
    track("projects.secrets.secret_mutated", {
      action: secret ? "updated" : "created",
      owner: team ? "team" : "user",
    });
    notify(
      secret ? `Secret "${secret.name}" replaced` : "Secret added",
      "success",
    );
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {secret ? `Replace ${secret.name}` : "Add a secret"}
        </DialogTitle>
        <DialogDescription>
          {dialogDescription({ secret, team })}
        </DialogDescription>
      </DialogHeader>
      <AddSecretForm
        existingSecret={secret}
        teamId={team?.id}
        onSuccess={handleSuccess}
        onCancel={cancel}
      />
    </>
  );
}
