import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { tracking } from "@/utils/tracking";

import { SecretsList } from "./SecretsList";

export function SecretsListView() {
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const handleRemoveSuccess = () => {
    track("settings.secrets.secret_mutated", { action: "deleted" });
    notify("Secret removed", "success");
  };

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

      <SecretsList onRemoveSuccess={handleRemoveSuccess} />

      <Separator />

      <InlineStack align="end" fill>
        <Link
          to="/settings/secrets/add"
          replace
          data-testid="add-secret-link"
          {...tracking("settings.secrets.add_secret")}
        >
          <Button variant="secondary">
            <Icon name="Plus" />
            Add Secret
          </Button>
        </Link>
      </InlineStack>
    </BlockStack>
  );
}
