import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";

interface AiProviderSetupProps {
  title?: string;
  description?: string;
}

export function AiProviderSetup({
  title = "Connect the AI assistant",
  description = "Configure an OpenAI-compatible provider to enable the assistant. The same settings power AI search and generated component descriptions.",
}: AiProviderSetupProps = {}) {
  return (
    <BlockStack className="h-full p-4" gap="3" align="start">
      <Heading level={3}>{title}</Heading>
      <Paragraph size="sm" tone="subdued">
        {description}
      </Paragraph>
      <Button asChild size="sm">
        <Link to={APP_ROUTES.SETTINGS_AGENT}>Open AI settings</Link>
      </Button>
    </BlockStack>
  );
}
