import { Suspense, useState } from "react";

import { AddSecretForm } from "@/components/shared/SecretsManagement/components/AddSecretForm";
import { SecretsList } from "@/components/shared/SecretsManagement/components/SecretsList";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";

type SecretsMode = "list" | "add" | "replace";

function SecretsSettingsSkeleton() {
  return (
    <BlockStack align="center" className="py-8">
      <Spinner size={10} />
    </BlockStack>
  );
}

function SecretsSettingsContent() {
  const notify = useToastNotification();

  const [mode, setMode] = useState<SecretsMode>("list");
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

  if (mode === "add") {
    return (
      <BlockStack gap="4">
        <InlineStack gap="2" blockAlign="center">
          <Button variant="ghost" size="sm" onClick={() => setMode("list")}>
            <Icon name="ArrowLeft" />
          </Button>
          <Heading level={2}>Add Secret</Heading>
        </InlineStack>
        <Separator />
        <AddSecretForm
          onSuccess={handleAddSuccess}
          onCancel={handleCancelForm}
        />
      </BlockStack>
    );
  }

  if (mode === "replace" && secretToReplace) {
    return (
      <BlockStack gap="4">
        <InlineStack gap="2" blockAlign="center">
          <Button variant="ghost" size="sm" onClick={handleCancelForm}>
            <Icon name="ArrowLeft" />
          </Button>
          <Heading level={2}>Replace Secret</Heading>
        </InlineStack>
        <Paragraph tone="subdued" size="sm">
          {`Update the value for secret "${secretToReplace.name}"`}
        </Paragraph>
        <Separator />
        <AddSecretForm
          existingSecret={secretToReplace}
          onSuccess={handleReplaceSuccess}
          onCancel={handleCancelForm}
        />
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <Heading level={2}>Secrets Management</Heading>
        <Paragraph tone="subdued" size="sm">
          Manage your secrets for use in pipelines. Secret values are stored
          securely and injected at runtime.
        </Paragraph>
      </BlockStack>

      <Separator />

      <SecretsList
        onReplace={handleStartReplace}
        onRemoveSuccess={handleRemoveSuccess}
      />

      <Separator />

      <InlineStack align="end">
        <Button variant="secondary" onClick={() => setMode("add")}>
          <Icon name="Plus" />
          Add Secret
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

export function SecretsSettings() {
  return (
    <Suspense fallback={<SecretsSettingsSkeleton />}>
      <SecretsSettingsContent />
    </Suspense>
  );
}
