import { useNavigate } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import { AddSecretForm } from "./AddSecretForm";
import { SecretsBreadcrumbs } from "./SecretsBreadcrumbs";

export function AddSecretView() {
  const notify = useToastNotification();
  const navigate = useNavigate();
  const { track } = useAnalytics();

  const navigateToList = () => {
    navigate({ to: "/settings/secrets", replace: true });
  };

  const handleSuccess = () => {
    track("settings.secrets.secret_mutated", { action: "created" });
    notify("Secret added successfully", "success");
    navigateToList();
  };

  return (
    <BlockStack gap="4">
      <SecretsBreadcrumbs title="Add Secret" />
      <Separator />
      <AddSecretForm onSuccess={handleSuccess} onCancel={navigateToList} />
    </BlockStack>
  );
}
