import { Link } from "@tanstack/react-router";

import NewPipelineButton from "@/components/shared/NewPipelineButton";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";

export function EmptyEditorState() {
  return (
    <BlockStack
      className="flex-1 min-h-0 w-full p-8"
      align="center"
      inlineAlign="center"
      gap="4"
    >
      <Heading level={2}>Open a pipeline</Heading>
      <InlineStack gap="3">
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.DASHBOARD_PIPELINES}>Browse pipelines</Link>
        </Button>
        <NewPipelineButton />
      </InlineStack>
    </BlockStack>
  );
}
