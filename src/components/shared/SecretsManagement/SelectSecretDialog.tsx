import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";

import { AddSecretForm } from "./components/AddSecretForm";
import { fetchSecretsList } from "./secretsStorage";
import { type Secret, SecretsQueryKeys } from "./types";

type DialogMode = "select" | "add";

interface SelectSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (secretName: string) => void;
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
  onSelect: (secret: Secret) => void;
}

function SelectableSecretsList({
  secrets,
  onSelect,
}: SelectableSecretsListProps) {
  if (secrets.length === 0) {
    return (
      <BlockStack align="center" className="py-8">
        <Icon name="Lock" size="lg" className="text-gray-300" />
        <Text tone="subdued">No secrets configured</Text>
        <Text size="xs" tone="subdued">
          Add a secret to use it in your arguments
        </Text>
      </BlockStack>
    );
  }

  return (
    <ScrollArea className="w-full min-h-[100px] max-h-[300px]" type="always">
      <BlockStack gap="2">
        {secrets.map((secret) => (
          <button
            key={secret.id}
            type="button"
            className="w-full text-left"
            onClick={() => onSelect(secret)}
          >
            <InlineStack
              align="space-between"
              gap="2"
              className="w-full pr-3 py-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
            >
              <InlineStack gap="2" blockAlign="center" wrap="nowrap">
                <Icon name="Lock" size="lg" />
                <BlockStack gap="0">
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

interface SelectSecretDialogContentProps {
  onSelect: (secretName: string) => void;
}

function SelectSecretDialogContentInternal({
  onSelect,
}: SelectSecretDialogContentProps) {
  const { data: secrets } = useSuspenseQuery({
    queryKey: SecretsQueryKeys.All(),
    queryFn: fetchSecretsList,
  });

  const [mode, setMode] = useState<DialogMode>("select");

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
        <AddSecretForm
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
        <SelectableSecretsList
          secrets={secrets}
          onSelect={handleSecretSelect}
        />
        <Separator />
        <InlineStack align="end" fill gap="2">
          <Button variant="secondary" onClick={() => setMode("add")}>
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

export function SelectSecretDialog({
  open,
  onOpenChange,
  onSelect,
}: SelectSecretDialogProps) {
  const handleSelect = (secretName: string) => {
    onSelect(secretName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent data-testid="select-secret-dialog">
          <SelectSecretDialogContent onSelect={handleSelect} />
        </DialogContent>
      )}
    </Dialog>
  );
}
