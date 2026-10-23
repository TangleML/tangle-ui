import { AddSecretForm } from "@/components/shared/SecretsManagement/components/AddSecretForm";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { TeamName } from "@/components/shared/Teams/TeamName";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { TeamSummary } from "@/services/teams/types";

import { ListRowIcon } from "./ListRowIcon";

export interface SecretFormDialogProps {
  secret?: Secret;
  team: TeamSummary;
}

function DialogDescriptionText({ secret, team }: SecretFormDialogProps) {
  if (secret) return "Runs that start after this use the new value.";
  return (
    <>
      {"Everyone in "}
      <TeamName team={team} />
      {" can use it in this project."}
    </>
  );
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
        <InlineStack gap="3" blockAlign="center" wrap="nowrap">
          {secret && <ListRowIcon icon="KeyRound" />}
          <BlockStack gap="1" className="min-w-0">
            <DialogTitle>
              {secret ? `Replace ${secret.name}` : "Add a workspace secret"}
            </DialogTitle>
            <DialogDescription>
              <DialogDescriptionText secret={secret} team={team} />
            </DialogDescription>
          </BlockStack>
        </InlineStack>
      </DialogHeader>
      <AddSecretForm
        existingSecret={secret}
        teamId={team.id}
        onSuccess={handleSuccess}
        onCancel={cancel}
      />
    </>
  );
}
