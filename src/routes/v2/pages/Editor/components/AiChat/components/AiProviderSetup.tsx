import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";

export function AiProviderSetup() {
  return (
    <BlockStack className="h-full p-4" gap="3" align="start">
      <Heading level={3}>Connect the AI assistant</Heading>
      <Paragraph size="sm" tone="subdued">
        Configure an OpenAI-compatible provider to enable the assistant. The
        same settings power AI search and generated component descriptions.
      </Paragraph>
      <Link to={APP_ROUTES.SETTINGS_AGENT}>
        <Button size="sm">Open AI settings</Button>
      </Link>
    </BlockStack>
  );
}
