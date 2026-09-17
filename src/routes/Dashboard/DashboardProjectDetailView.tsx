import { Link, useParams } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";

export function DashboardProjectDetailView() {
  const { projectId } = useParams({ strict: false });

  return (
    <BlockStack gap="4">
      <Link to={APP_ROUTES.PROJECTS} className="w-fit">
        <InlineStack gap="1" blockAlign="center">
          <Icon name="ArrowLeft" size="sm" />
          <Text size="sm">Back to projects</Text>
        </InlineStack>
      </Link>
      <Heading level={2}>Project</Heading>
      <Text tone="subdued">{projectId}</Text>
    </BlockStack>
  );
}
