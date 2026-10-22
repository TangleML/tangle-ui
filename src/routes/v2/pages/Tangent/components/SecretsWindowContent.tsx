import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { secretsListQuery } from "@/components/shared/SecretsManagement/secretsStorage";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";
import { tracking } from "@/utils/tracking";

import {
  SecretFormDialog,
  type SecretFormDialogProps,
} from "./SecretFormDialog";
import { SecretRow } from "./SecretRow";

type ActiveTeam = Extract<TeamResolution, { status: "active" }>["team"];

type UnavailableTeamResolution = Exclude<
  TeamResolution,
  { status: "none" | "resolving" | "active" }
>;

const LoadingSecrets = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function SecretsWindowContent() {
  const store = useTangentProject();
  const resolution = useTeamForProjects([store.projectId]);

  return (
    <BlockStack gap="4" className="p-2">
      <SecretsWindowBody resolution={resolution} />
    </BlockStack>
  );
}

function SecretsWindowBody({ resolution }: { resolution: TeamResolution }) {
  switch (resolution.status) {
    case "none":
      return null;
    case "resolving":
      return <LoadingSecrets />;
    case "active":
      return <WorkspaceSecrets team={resolution.team} />;
    default:
      return <WorkspaceSecretsUnavailable resolution={resolution} />;
  }
}

function WorkspaceSecretsUnavailable({
  resolution,
}: {
  resolution: UnavailableTeamResolution;
}) {
  return (
    <InfoBox
      title="Workspace secrets aren't available"
      variant="warning"
      width="full"
    >
      <UnavailableReason resolution={resolution} />
    </InfoBox>
  );
}

function UnavailableReason({
  resolution,
}: {
  resolution: UnavailableTeamResolution;
}) {
  switch (resolution.status) {
    case "not-member":
      return `You're not in the ${resolution.team.label} workspace. Ask an admin to add you.`;
    case "unavailable":
      return `The backend didn't let you act as the ${resolution.team.label} workspace.`;
    case "error":
      return `Couldn't check your access to this project's workspace: ${resolution.error.message}`;
    default:
      return null;
  }
}

function WorkspaceHeader({ team }: { team: ActiveTeam }) {
  return (
    <BlockStack gap="1">
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Icon
          name="Shapes"
          size="xs"
          className="shrink-0 text-muted-foreground"
        />
        <Text
          size="sm"
          weight="semibold"
          className="min-w-0 truncate"
          title={team.id}
        >
          {`Workspace: ${team.label}`}
        </Text>
      </InlineStack>
      <Text size="xs" tone="subdued">
        {team.canWrite
          ? "Runs in this project use these secrets. Everyone in the workspace can see and change them."
          : "Runs in this project use these secrets. Your role in the workspace can't change them."}
      </Text>
    </BlockStack>
  );
}

function WorkspaceSecrets({ team }: { team: ActiveTeam }) {
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const {
    data: secrets,
    isPending,
    error,
  } = useQuery(secretsListQuery(team.id));

  const openSecretDialog = (secret?: Secret) =>
    void open<void, SecretFormDialogProps>({
      component: SecretFormDialog,
      props: { secret, team },
      routeKey: secret ? "replace-secret" : "add-secret",
      size: "md",
    }).catch(convertCancelErrorTo(undefined));

  const handleRemoved = () => {
    track("projects.secrets.secret_mutated", { action: "deleted" });
    notify("Secret deleted", "success");
  };

  return (
    <>
      <WorkspaceHeader team={team} />

      {isPending && <LoadingSecrets />}

      {error && (
        <InfoBox title="Error loading secrets" variant="error">
          {error.message}
        </InfoBox>
      )}

      {secrets && secrets.length === 0 && (
        <Text size="sm" tone="subdued">
          No workspace secrets yet
        </Text>
      )}

      {secrets && secrets.length > 0 && (
        <BlockStack className="border rounded-md divide-y">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.id}
              secret={secret}
              teamId={team.id}
              canWrite={team.canWrite}
              onReplace={openSecretDialog}
              onRemoved={handleRemoved}
            />
          ))}
        </BlockStack>
      )}

      {team.canWrite && (
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
