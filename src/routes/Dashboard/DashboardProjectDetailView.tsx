import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";

export function DashboardProjectDetailView() {
  return (
    <BlockStack gap="4">
      <Link to={APP_ROUTES.PROJECTS} className="w-fit">
        <InlineStack gap="1" blockAlign="center">
          <Icon name="ArrowLeft" size="sm" />
          <Text size="sm">Back to projects</Text>
        </InlineStack>
      </Link>
      <EmptyState
        icon="FolderKanban"
        spotlight
        placement="start"
        title="Project page coming soon"
        description="You will be able to view this project and manage what is in it here."
      />
    </BlockStack>
  );
}
