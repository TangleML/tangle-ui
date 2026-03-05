import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";

import { fetchSecretsList } from "../secretsStorage";
import { SecretsQueryKeys } from "../types";
import { AddSecretForm } from "./AddSecretForm";
import { SecretsBreadcrumbs } from "./SecretsBreadcrumbs";

export function ReplaceSecretView() {
  const { secretId } = useParams({ strict: false });
  const notify = useToastNotification();
  const navigate = useNavigate();

  const { data: secrets } = useSuspenseQuery({
    queryKey: SecretsQueryKeys.All(),
    queryFn: fetchSecretsList,
  });

  const secret = secrets.find((s) => s.id === secretId);

  const navigateToList = () => {
    navigate({ to: "/settings/secrets", replace: true });
  };

  useEffect(() => {
    if (!secret) {
      navigateToList();
    }
  }, [secret, navigateToList]);

  if (!secret) {
    return null;
  }

  const handleSuccess = () => {
    notify(`Secret "${secret.name}" updated successfully`, "success");
    navigateToList();
  };

  return (
    <BlockStack gap="4">
      <SecretsBreadcrumbs title="Replace Secret" />
      <Paragraph tone="subdued" size="sm">
        {`Update the value for secret "${secret.name}"`}
      </Paragraph>
      <Separator />
      <AddSecretForm
        existingSecret={secret}
        onSuccess={handleSuccess}
        onCancel={navigateToList}
      />
    </BlockStack>
  );
}
