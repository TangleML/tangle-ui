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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";

import { AddSecretForm } from "./components/AddSecretForm";
import { SecretsList } from "./components/SecretsList";
import { getSecrets, SecretsQueryKeys } from "./secretsStorage";
import type { Secret } from "./types";

type DialogMode = "list" | "add" | "replace";

interface ManageSecretsDialogProps {
  defaultMode?: DialogMode;
  trigger?: React.ReactNode;
}

interface ManageSecretsDialogContentProps {
  defaultMode: DialogMode;
}

function ManageSecretsDialogContentSkeleton() {
  return (
    <BlockStack align="center" className="py-8">
      <Spinner />
    </BlockStack>
  );
}

function ManageSecretsDialogContentInternal({
  defaultMode = "list",
}: ManageSecretsDialogContentProps) {
  const notify = useToastNotification();

  const { data: secrets } = useSuspenseQuery({
    queryKey: SecretsQueryKeys.All(),
    queryFn: getSecrets,
  });

  const [mode, setMode] = useState<DialogMode>(defaultMode);
  const [secretToReplace, setSecretToReplace] = useState<Secret | undefined>();

  const handleAddSuccess = () => {
    notify("Secret added successfully", "success");
    setMode("list");
  };

  const handleReplaceSuccess = () => {
    notify(`Secret "${secretToReplace?.name}" updated successfully`, "success");
    setSecretToReplace(undefined);
    setMode("list");
  };

  const handleRemoveSuccess = () => {
    notify("Secret removed", "success");
  };

  const handleStartReplace = (secret: Secret) => {
    setSecretToReplace(secret);
    setMode("replace");
  };

  const handleCancelForm = () => {
    setSecretToReplace(undefined);
    setMode("list");
  };

  return (
    <>
      {mode === "add" && (
        <>
          <DialogHeader>
            <DialogTitle>
              <InlineStack align="start" gap="1" blockAlign="center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("list")}
                >
                  <Icon name="ArrowLeft" />
                </Button>
                Add Secret
              </InlineStack>
            </DialogTitle>
          </DialogHeader>
          <AddSecretForm
            onSuccess={handleAddSuccess}
            onCancel={handleCancelForm}
          />
        </>
      )}

      {mode === "replace" && secretToReplace && (
        <>
          <DialogHeader>
            <DialogTitle>
              <InlineStack align="start" gap="1" blockAlign="center">
                <Button variant="ghost" size="sm" onClick={handleCancelForm}>
                  <Icon name="ArrowLeft" />
                </Button>
                Replace Secret
              </InlineStack>
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Update the value for secret &ldquo;{secretToReplace.name}&rdquo;
          </DialogDescription>
          <AddSecretForm
            existingSecret={secretToReplace}
            onSuccess={handleReplaceSuccess}
            onCancel={handleCancelForm}
          />
        </>
      )}

      {mode === "list" && (
        <>
          <DialogHeader>
            <DialogTitle>Manage Secrets</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Manage your secrets for use in pipelines. Secret values are stored
            securely and injected at runtime.
          </DialogDescription>
          <BlockStack gap="4">
            <SecretsList
              secrets={secrets}
              onReplace={handleStartReplace}
              onRemoveSuccess={handleRemoveSuccess}
            />
            <Separator />
            <BlockStack gap="1" align="end">
              <Button variant="secondary" onClick={() => setMode("add")}>
                <InlineStack align="center" gap="1">
                  <Icon name="Plus" />
                  Add Secret
                </InlineStack>
              </Button>
            </BlockStack>
          </BlockStack>
        </>
      )}
    </>
  );
}

const ManageSecretsDialogContent = withSuspenseWrapper(
  ManageSecretsDialogContentInternal,
  ManageSecretsDialogContentSkeleton,
);

export function ManageSecretsDialog({
  defaultMode = "list",
  trigger,
}: ManageSecretsDialogProps) {
  const [open, setOpen] = useState(false);

  const handleDialogOpenChange = (open: boolean) => {
    setOpen(open);
  };

  const defaultTrigger = (
    <Button variant="outline" size="xs">
      Manage Secrets
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      {open && (
        <DialogContent data-testid="manage-secrets-dialog">
          <ManageSecretsDialogContent defaultMode={defaultMode} />
        </DialogContent>
      )}
    </Dialog>
  );
}
