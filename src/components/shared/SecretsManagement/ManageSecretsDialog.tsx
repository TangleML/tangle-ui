import { type ReactNode, useState } from "react";

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
import type { Secret } from "./types";

type DialogMode = "list" | "add" | "replace";

interface ManageSecretsDialogProps {
  defaultMode?: DialogMode;
  trigger?: ReactNode;
}

interface ManageSecretsDialogContentProps {
  defaultMode: DialogMode;
}

function ManageSecretsDialogContentSkeleton() {
  return <Spinner size={10} />;
}

function ManageSecretsDialogContentInternal({
  defaultMode = "list",
}: ManageSecretsDialogContentProps) {
  const notify = useToastNotification();

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
    <DialogContent
      data-testid="manage-secrets-dialog"
      key="manage-secrets-dialog"
    >
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
            {`Update the value for secret "${secretToReplace.name}"`}
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
    </DialogContent>
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
      {open && <ManageSecretsDialogContent defaultMode={defaultMode} />}
    </Dialog>
  );
}
