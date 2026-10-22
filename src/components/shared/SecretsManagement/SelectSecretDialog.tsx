import { useSuspenseQueries } from "@tanstack/react-query";
import { useId, useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { ActingTeamNotice } from "@/components/shared/Teams/ActingTeamNotice";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radiogroup";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMockBackend } from "@/providers/TourProvider/tourMockBackend";
import { actingTeamId } from "@/services/teams/teamResolution";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";
import { useActingTeam } from "@/services/teams/useActingTeam";

import { AddSecretForm } from "./components/AddSecretForm";
import { SecretsBackendUnavailable } from "./components/SecretsBackendUnavailable";
import { secretsListQuery } from "./secretsStorage";
import type { Secret } from "./types";

type DialogMode = "select" | "add";
type SecretOwner = "you" | "team";

interface SelectSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (secretName: string) => void;
  team?: TeamResolution;
}

function SelectSecretDialogContentSkeleton() {
  return (
    <BlockStack align="center" className="py-8">
      <Spinner />
    </BlockStack>
  );
}

interface SelectableSecretsListProps {
  secrets: Secret[];
  emptyTitle: string;
  onSelect: (secret: Secret) => void;
}

function SelectableSecretsList({
  secrets,
  emptyTitle,
  onSelect,
}: SelectableSecretsListProps) {
  if (secrets.length === 0) {
    return (
      <EmptyState
        icon="Lock"
        title={emptyTitle}
        description="Add a secret to use it in your arguments"
        placement="start"
        data-testid="select-secret-empty-state"
      />
    );
  }

  return (
    <ScrollArea
      className="w-full min-h-25 max-h-75"
      type="always"
      data-testid="select-secret-list"
    >
      <BlockStack gap="2">
        {secrets.map((secret) => (
          <button
            key={secret.id}
            type="button"
            className="w-full text-left"
            onClick={() => onSelect(secret)}
            data-testid="selectable-secret-item"
            data-secret-name={secret.name}
          >
            <InlineStack
              align="space-between"
              gap="2"
              className="w-full pr-3 py-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors dark:hover:bg-accent"
            >
              <InlineStack gap="2" blockAlign="center" wrap="nowrap">
                <Icon name="Lock" size="lg" className="shrink-0" />
                <BlockStack>
                  <Text size="sm" weight="semibold">
                    {secret.name}
                  </Text>
                </BlockStack>
              </InlineStack>
              <Icon name="ChevronRight" size="sm" className="text-gray-400" />
            </InlineStack>
          </button>
        ))}
      </BlockStack>
    </ScrollArea>
  );
}

function SecretsGroup({
  team,
  secrets,
  onSelect,
}: {
  team?: TeamSummary;
  secrets: Secret[];
  onSelect: (secret: Secret) => void;
}) {
  return (
    <BlockStack gap="2" data-testid={team ? "team-secrets" : "your-secrets"}>
      {team ? (
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name="Users"
            size="xs"
            className="shrink-0 text-muted-foreground"
          />
          <Text
            size="sm"
            tone="subdued"
            className="min-w-0 truncate"
            title={team.id}
          >
            {`The ${team.label} workspace's secrets`}
          </Text>
        </InlineStack>
      ) : (
        <Text size="sm" tone="subdued" data-testid="your-secrets-heading">
          Your secrets
        </Text>
      )}
      <SelectableSecretsList
        secrets={secrets}
        emptyTitle={
          team ? "The workspace has no secrets" : "You have no secrets"
        }
        onSelect={onSelect}
      />
    </BlockStack>
  );
}

function SaveToControl({
  team,
  saveTo,
  onChange,
}: {
  team: TeamSummary;
  saveTo: SecretOwner;
  onChange: (saveTo: SecretOwner) => void;
}) {
  const id = useId();

  return (
    <BlockStack gap="1">
      <Text size="sm" tone="subdued" id={`${id}-label`}>
        Save to
      </Text>
      <RadioGroup
        value={saveTo}
        onValueChange={(value) => onChange(value === "team" ? "team" : "you")}
        aria-labelledby={`${id}-label`}
        className="flex flex-wrap gap-4"
      >
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <RadioGroupItem id={`${id}-you`} value="you" />
          <Label htmlFor={`${id}-you`} className="font-normal">
            Your secrets
          </Label>
        </InlineStack>
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          <RadioGroupItem id={`${id}-team`} value="team" />
          <Label htmlFor={`${id}-team`} className="gap-1 font-normal">
            {"The "}
            <TeamName team={team} />
            {" workspace's secrets"}
          </Label>
        </InlineStack>
      </RadioGroup>
      {saveTo === "team" && (
        <Text size="xs" tone="subdued" data-testid="save-to-team-hint">
          {"Everyone in "}
          <TeamName team={team} />
          {" can use it in this project."}
        </Text>
      )}
    </BlockStack>
  );
}

interface SelectSecretDialogContentProps {
  resolution: Exclude<TeamResolution, { status: "resolving" | "conflict" }>;
  onSelect: (secretName: string) => void;
}

function SelectSecretDialogContentInternal({
  resolution,
  onSelect,
}: SelectSecretDialogContentProps) {
  const teamId = actingTeamId(resolution);
  const team = resolution.status === "active" ? resolution.team : undefined;
  const writableTeam = team?.canWrite ? team : undefined;

  const [yourSecrets, teamSecrets] = useSuspenseQueries({
    queries: [undefined, ...(teamId ? [teamId] : [])].map(secretsListQuery),
  });

  const [mode, setMode] = useState<DialogMode>("select");
  const [saveTo, setSaveTo] = useState<SecretOwner>("you");

  const handleSecretSelect = (secret: Secret) => {
    onSelect(secret.name);
  };

  const handleAddSuccess = () => {
    setMode("select");
  };

  const handleBackToSelect = () => {
    setMode("select");
  };

  if (mode === "add") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            <InlineStack align="start" gap="1" blockAlign="center">
              <Button variant="ghost" size="sm" onClick={handleBackToSelect}>
                <Icon name="ArrowLeft" />
              </Button>
              Add Secret
            </InlineStack>
          </DialogTitle>
        </DialogHeader>
        {writableTeam && (
          <SaveToControl
            team={writableTeam}
            saveTo={saveTo}
            onChange={setSaveTo}
          />
        )}
        <AddSecretForm
          teamId={
            writableTeam && saveTo === "team" ? writableTeam.id : undefined
          }
          onSuccess={handleAddSuccess}
          onCancel={handleBackToSelect}
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Select a Secret</DialogTitle>
      </DialogHeader>
      <DialogDescription>
        Choose a secret to use as the value for this argument. The secret will
        be injected at runtime.
      </DialogDescription>
      <BlockStack gap="4">
        <ActingTeamNotice resolution={resolution} />
        {team && teamSecrets ? (
          <>
            <SecretsGroup
              secrets={yourSecrets.data}
              onSelect={handleSecretSelect}
            />
            <SecretsGroup
              team={team}
              secrets={teamSecrets.data}
              onSelect={handleSecretSelect}
            />
          </>
        ) : (
          <SelectableSecretsList
            secrets={yourSecrets.data}
            emptyTitle="No secrets configured"
            onSelect={handleSecretSelect}
          />
        )}
        <Separator />
        <InlineStack align="end" gap="2" className="w-full">
          <Button
            variant="secondary"
            onClick={() => setMode("add")}
            data-testid="select-secret-add-button"
          >
            <InlineStack align="center" gap="1">
              <Icon name="Plus" />
              Add Secret
            </InlineStack>
          </Button>
        </InlineStack>
      </BlockStack>
    </>
  );
}

const SelectSecretDialogContent = withSuspenseWrapper(
  SelectSecretDialogContentInternal,
  SelectSecretDialogContentSkeleton,
);

interface TeamSecretsPickerProps {
  resolution: TeamResolution;
  onSelect: (secretName: string) => void;
}

function TeamSecretsPicker({ resolution, onSelect }: TeamSecretsPickerProps) {
  if (resolution.status === "resolving") {
    return <SelectSecretDialogContentSkeleton />;
  }

  if (resolution.status === "conflict") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Select a Secret</DialogTitle>
        </DialogHeader>
        <ActingTeamNotice resolution={resolution} />
      </>
    );
  }

  return (
    <SelectSecretDialogContent
      key={actingTeamId(resolution) ?? "user"}
      resolution={resolution}
      onSelect={onSelect}
    />
  );
}

function PageTeamSecretsPicker({
  onSelect,
}: Pick<TeamSecretsPickerProps, "onSelect">) {
  return <TeamSecretsPicker resolution={useActingTeam()} onSelect={onSelect} />;
}

export function SelectSecretDialog({
  open,
  onOpenChange,
  onSelect,
  team,
}: SelectSecretDialogProps) {
  const { available } = useBackend();
  const mockBackend = useTourMockBackend();
  const handleSelect = (secretName: string) => {
    onSelect(secretName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent data-testid="select-secret-dialog">
          {!available && !mockBackend && <SecretsBackendUnavailable />}
          {(available || mockBackend) &&
            (team ? (
              <TeamSecretsPicker resolution={team} onSelect={handleSelect} />
            ) : (
              <PageTeamSecretsPicker onSelect={handleSelect} />
            ))}
        </DialogContent>
      )}
    </Dialog>
  );
}
