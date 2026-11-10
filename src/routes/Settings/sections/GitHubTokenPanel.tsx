import { useState } from "react";

import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { GitHubTokenStatus } from "@/services/github/githubBackendClient";
import {
  useChooseTokenSecret,
  useClearTokenSecret,
} from "@/services/github/useGitHubToken";
import { tracking } from "@/utils/tracking";

import { ChooseTokenSecretDialog } from "./ChooseTokenSecretDialog";

function stateSummary({ state, login, secretName }: GitHubTokenStatus) {
  switch (state) {
    case "valid":
      return login ? `Connected as @${login}` : "Connected";
    case "not_configured":
      return null;
    case "secret_missing":
      return `The secret "${secretName}" no longer exists.`;
    case "invalid":
      return "GitHub doesn't accept this token.";
  }
}

function ClassicTokenWarning() {
  return (
    <InfoBox title="This is a classic token" variant="warning">
      It can read and write everything your GitHub account can. Use a
      fine-grained, read-only token instead.
    </InfoBox>
  );
}

interface GitHubTokenPanelProps {
  status: GitHubTokenStatus;
}

export function GitHubTokenPanel({ status }: GitHubTokenPanelProps) {
  const [isChoosing, setIsChoosing] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const chooseSecret = useChooseTokenSecret();
  const clearSecret = useClearTokenSecret();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const { secretName, state, tokenKind } = status;
  const isConnected = state === "valid";
  const needsAttention = state === "secret_missing" || state === "invalid";
  const summary = stateSummary(status);

  const choose = (name: string) => {
    chooseSecret.mutate(name, {
      onSuccess: () => {
        track("settings.github.choose_token_secret_completed", {
          replaced: secretName !== null,
        });
        notify(`Using "${name}" as your GitHub token`, "success");
        setIsChoosing(false);
      },
    });
  };

  const unlink = () => {
    setIsConfirmingUnlink(false);
    clearSecret.mutate(undefined, {
      onSuccess: () => {
        track("settings.github.clear_token_secret_completed");
        notify("Unlinked your GitHub token", "success");
      },
    });
  };

  return (
    <BlockStack gap="3">
      <Heading level={3}>Token</Heading>

      <InlineStack
        gap="3"
        blockAlign="center"
        wrap="nowrap"
        className="w-full rounded-md border border-border p-3"
      >
        <Icon name="KeyRound" size="lg" className="shrink-0" />
        <BlockStack gap="1" className="min-w-0 flex-1">
          <InlineStack gap="2" blockAlign="center">
            <Text size="sm" weight="semibold" className="break-all">
              {secretName ?? "No secret chosen"}
            </Text>
            {isConnected && (
              <Badge size="sm" variant="inform">
                Connected
              </Badge>
            )}
            {needsAttention && (
              <Badge size="sm" variant="destructive">
                Needs attention
              </Badge>
            )}
          </InlineStack>
          {summary && (
            <Text size="xs" tone="subdued">
              {summary}
            </Text>
          )}
        </BlockStack>
        <InlineStack gap="1" wrap="nowrap" className="shrink-0">
          {secretName === null ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsChoosing(true)}
              {...tracking("settings.github.choose_token_secret")}
            >
              <Icon name="Plus" size="sm" />
              Add
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChoosing(true)}
                {...tracking("settings.github.choose_token_secret")}
              >
                <Icon name="ArrowLeftRight" size="sm" />
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={clearSecret.isPending}
                onClick={() => setIsConfirmingUnlink(true)}
                {...tracking("settings.github.clear_token_secret")}
              >
                <Icon name="Unlink" size="sm" />
                Unlink
              </Button>
            </>
          )}
        </InlineStack>
      </InlineStack>

      {isConnected && tokenKind === "classic" && <ClassicTokenWarning />}

      {isChoosing && (
        <ChooseTokenSecretDialog
          currentSecretName={secretName}
          isSaving={chooseSecret.isPending}
          onConfirm={choose}
          onDismiss={() => setIsChoosing(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={isConfirmingUnlink}
        title="Unlink this token?"
        description="Agents will stop using it for the repositories you've linked."
        confirmLabel="Unlink"
        onConfirm={unlink}
        onCancel={() => setIsConfirmingUnlink(false)}
      />
    </BlockStack>
  );
}
