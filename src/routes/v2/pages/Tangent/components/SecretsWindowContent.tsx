import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useDeleteWorkspaceSecretAction } from "@/components/WorkspaceSecrets/useDeleteWorkspaceSecretAction";
import {
  WorkspaceSecretDialog,
  type WorkspaceSecretDialogProps,
} from "@/components/WorkspaceSecrets/WorkspaceSecretDialog";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import type { WorkspaceSecret } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";
import { useWorkspaceSecrets } from "@/services/projects/useWorkspaceSecrets";
import { tracking } from "@/utils/tracking";

import { SecretRow } from "./SecretRow";

const LoadingSecrets = () => (
  <InlineStack gap="2" blockAlign="center">
    <Spinner /> Loading...
  </InlineStack>
);

export function SecretsWindowContent() {
  const store = useTangentProject();
  const { data: project } = useProject(store.projectId);

  return (
    <BlockStack gap="4" className="p-2">
      {project ? (
        <WorkspaceSecrets workspaceId={project.workspaceId} />
      ) : (
        <LoadingSecrets />
      )}
    </BlockStack>
  );
}

function WorkspaceSecrets({ workspaceId }: { workspaceId: string }) {
  const { data: workspace } = useWorkspace(workspaceId);
  const { data, isPending, error } = useWorkspaceSecrets(workspaceId);
  const { open } = useDialog();
  const { confirmAndDelete, isDeleting, confirmation } =
    useDeleteWorkspaceSecretAction(workspaceId);

  const openSecretDialog = (secret?: WorkspaceSecret) =>
    void open<WorkspaceSecret, WorkspaceSecretDialogProps>({
      component: WorkspaceSecretDialog,
      props: { workspaceId, secret },
      routeKey: secret ? "replace-workspace-secret" : "add-workspace-secret",
      size: "md",
    }).catch(convertCancelErrorTo(undefined));

  const secrets = data?.secrets ?? [];

  return (
    <>
      {workspace && (
        <Text size="xs" tone="subdued">
          {`Shared with every project in ${workspace.name}.`}
        </Text>
      )}

      {isPending && <LoadingSecrets />}

      {error && (
        <InfoBox title="Error loading secrets" variant="error">
          {error.message}
        </InfoBox>
      )}

      {data && secrets.length === 0 && (
        <Text size="sm" tone="subdued">
          No secrets in this workspace yet
        </Text>
      )}

      {secrets.length > 0 && (
        <BlockStack className="border rounded-md divide-y">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.name}
              secret={secret}
              disabled={isDeleting}
              onReplace={openSecretDialog}
              onDelete={(target) => void confirmAndDelete(target)}
            />
          ))}
        </BlockStack>
      )}

      {data?.canCreate && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => openSecretDialog()}
          {...tracking("projects.workspace_secrets.add_open")}
        >
          <Icon name="Plus" size="xs" />
          Add a secret
        </Button>
      )}

      <ConfirmationDialog {...confirmation} />
    </>
  );
}
