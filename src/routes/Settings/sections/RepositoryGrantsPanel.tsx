import { useState } from "react";

import { PrivateRepositoryBadge } from "@/components/Project/PrivateRepositoryBadge";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { RepositoryGrant } from "@/services/github/githubBackendClient";
import {
  useRepositoryGrants,
  useRevokeRepositoryGrant,
} from "@/services/github/useGitHubToken";
import { formatRelativeTime } from "@/utils/date";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

const fullName = ({ owner, repo }: RepositoryGrant) => `${owner}/${repo}`;

const revokeConsequence = (grant: RepositoryGrant | null) =>
  grant?.isPrivate
    ? "Agents will no longer be able to read it."
    : "Agents will read it without your token.";

interface GrantRowProps {
  grant: RepositoryGrant;
  isRevoking: boolean;
  onRevoke: (grant: RepositoryGrant) => void;
}

function GrantRow({ grant, isRevoking, onRevoke }: GrantRowProps) {
  return (
    <InlineStack
      as="li"
      gap="3"
      blockAlign="center"
      wrap="nowrap"
      className="w-full rounded-md px-1 py-1.5"
    >
      <Icon name="FolderGit2" size="lg" className="shrink-0" />
      <BlockStack className="min-w-0 flex-1">
        <InlineStack gap="2" blockAlign="center">
          <Text size="sm" weight="semibold" className="break-all">
            {fullName(grant)}
          </Text>
          {grant.isPrivate && <PrivateRepositoryBadge />}
        </InlineStack>
        <Text size="xs" tone="subdued">
          Added {formatRelativeTime(grant.createdAt)}
        </Text>
      </BlockStack>
      <Button
        variant="outline"
        size="sm"
        disabled={isRevoking}
        onClick={() => onRevoke(grant)}
        aria-label={`Revoke access to ${fullName(grant)}`}
        {...tracking("settings.github.revoke_repository_grant")}
      >
        Revoke
      </Button>
    </InlineStack>
  );
}

interface GrantsListProps {
  grants: RepositoryGrant[] | undefined;
  error: Error | null;
  isPending: boolean;
  revokingGrantId: string | undefined;
  onRevoke: (grant: RepositoryGrant) => void;
}

function GrantsList({
  grants,
  error,
  isPending,
  revokingGrantId,
  onRevoke,
}: GrantsListProps) {
  if (isPending) {
    return (
      <BlockStack align="center" className="py-6">
        <Spinner />
      </BlockStack>
    );
  }

  if (error) {
    return (
      <InfoBox title="Couldn't load your linked repositories" variant="error">
        {getErrorMessage(error)}
      </InfoBox>
    );
  }

  if (!grants?.length) {
    return (
      <EmptyState
        icon="FolderGit2"
        title="No linked repositories"
        placement="start"
        size="sm"
      />
    );
  }

  return (
    <BlockStack as="ul" gap="1">
      {grants.map((grant) => (
        <GrantRow
          key={grant.id}
          grant={grant}
          isRevoking={revokingGrantId === grant.id}
          onRevoke={onRevoke}
        />
      ))}
    </BlockStack>
  );
}

export function RepositoryGrantsPanel() {
  const { data: grants, error, isPending } = useRepositoryGrants();
  const revokeGrant = useRevokeRepositoryGrant();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const [revokeTarget, setRevokeTarget] = useState<RepositoryGrant | null>(
    null,
  );
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false);

  const askToRevoke = (grant: RepositoryGrant) => {
    setRevokeTarget(grant);
    setIsConfirmingRevoke(true);
  };

  const revoke = () => {
    setIsConfirmingRevoke(false);
    if (!revokeTarget) return;

    const grant = revokeTarget;
    revokeGrant.mutate(grant.id, {
      onSuccess: () => {
        track("settings.github.revoke_repository_grant_completed", {
          private: grant.isPrivate,
        });
        notify(`Revoked access to ${fullName(grant)}`, "success");
      },
    });
  };

  return (
    <BlockStack gap="3">
      <Heading level={3}>Linked repositories</Heading>

      <GrantsList
        grants={grants}
        error={error}
        isPending={isPending}
        revokingGrantId={
          revokeGrant.isPending ? revokeGrant.variables : undefined
        }
        onRevoke={askToRevoke}
      />

      <ConfirmationDialog
        isOpen={isConfirmingRevoke}
        title={
          revokeTarget
            ? `Revoke access to ${fullName(revokeTarget)}?`
            : undefined
        }
        description={revokeConsequence(revokeTarget)}
        confirmLabel="Revoke"
        onConfirm={revoke}
        onCancel={() => setIsConfirmingRevoke(false)}
      />
    </BlockStack>
  );
}
