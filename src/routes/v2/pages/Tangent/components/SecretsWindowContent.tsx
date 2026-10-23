import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { SecretsBackendUnavailable } from "@/components/shared/SecretsManagement/components/SecretsBackendUnavailable";
import { secretsListQuery } from "@/components/shared/SecretsManagement/secretsStorage";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { ActingTeamNotice } from "@/components/shared/Teams/ActingTeamNotice";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { actingTeamId } from "@/services/teams/teamResolution";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";
import { tracking } from "@/utils/tracking";

import {
  SecretFormDialog,
  type SecretFormDialogProps,
} from "./SecretFormDialog";
import { SecretRow } from "./SecretRow";

type SettledTeamResolution = Exclude<TeamResolution, { status: "resolving" }>;

const LoadingSecrets = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function SecretsWindowContent() {
  const store = useTangentProject();
  const { available } = useBackend();
  const resolution = useTeamForProjects([store.projectId]);

  return (
    <BlockStack gap="4" className="p-2">
      {!available && <SecretsBackendUnavailable />}
      {available && resolution.status === "resolving" && <LoadingSecrets />}
      {available && resolution.status !== "resolving" && (
        <ProjectSecrets resolution={resolution} />
      )}
    </BlockStack>
  );
}

function SecretsOwner({ resolution }: { resolution: SettledTeamResolution }) {
  if (resolution.status === "active") {
    return (
      <BlockStack gap="1">
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name="Users"
            size="xs"
            className="shrink-0 text-muted-foreground"
          />
          <Text
            size="sm"
            weight="semibold"
            className="min-w-0 truncate"
            title={resolution.team.id}
          >
            {`Team: ${resolution.team.label}`}
          </Text>
        </InlineStack>
        <Text size="xs" tone="subdued">
          {resolution.team.canWrite
            ? "Runs in this project use these secrets. Everyone in the team can see and change them."
            : "Runs in this project use these secrets. Your role in the team can't change them."}
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="1">
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Icon
          name="User"
          size="xs"
          className="shrink-0 text-muted-foreground"
        />
        <Text size="sm" weight="semibold">
          My secrets
        </Text>
      </InlineStack>
      {resolution.status === "none" && (
        <Text size="xs" tone="subdued">
          Runs you submit in this project use your own secrets.
        </Text>
      )}
    </BlockStack>
  );
}

function ProjectSecrets({ resolution }: { resolution: SettledTeamResolution }) {
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const teamId = actingTeamId(resolution);
  const team = resolution.status === "active" ? resolution.team : undefined;
  const canWrite = team?.canWrite ?? true;
  const blocked = resolution.status === "conflict";

  const {
    data: secrets,
    isPending,
    error,
  } = useQuery({ ...secretsListQuery(teamId), enabled: !blocked });

  const openSecretDialog = (secret?: Secret) =>
    void open<void, SecretFormDialogProps>({
      component: SecretFormDialog,
      props: { secret, team },
      routeKey: secret ? "replace-secret" : "add-secret",
      size: "md",
    }).catch(convertCancelErrorTo(undefined));

  const handleRemoved = () => {
    track("projects.secrets.secret_mutated", {
      action: "deleted",
      owner: team ? "team" : "user",
    });
    notify("Secret deleted", "success");
  };

  if (blocked) return <ActingTeamNotice resolution={resolution} />;

  return (
    <>
      <SecretsOwner resolution={resolution} />
      <ActingTeamNotice resolution={resolution} />

      {isPending && <LoadingSecrets />}

      {error && (
        <InfoBox title="Error loading secrets" variant="error">
          {error.message}
        </InfoBox>
      )}

      {secrets && secrets.length > 0 && (
        <BlockStack className="border rounded-md divide-y">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.id}
              secret={secret}
              teamId={teamId}
              canWrite={canWrite}
              onReplace={openSecretDialog}
              onRemoved={handleRemoved}
            />
          ))}
        </BlockStack>
      )}

      {canWrite && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => openSecretDialog()}
          {...tracking("projects.secrets.add_open")}
        >
          <Icon name="Plus" size="xs" />
          Add a secret
        </Button>
      )}
    </>
  );
}
