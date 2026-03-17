import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { HuggingFaceAuthButton } from "@/components/shared/HuggingFaceAuth/HuggingFaceAuthButton";
import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { RecentExecutionsButton } from "@/components/shared/ReactFlow/FlowSidebar/components/RecentExecutionsButton";
import GoogleCloudSubmissionDialog from "@/components/shared/Submitters/GoogleCloud/GoogleCloudSubmissionDialog";
import OasisSubmitter from "@/components/shared/Submitters/Oasis/OasisSubmitter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import { JsonSerializer } from "@/models/componentSpec";
import type { ComponentSpec } from "@/utils/componentSpec";

import { navigationStore } from "../store/navigationStore";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const serializer = new JsonSerializer();

const showGoogleSubmitter =
  import.meta.env.VITE_ENABLE_GOOGLE_CLOUD_SUBMITTER === "true";

export const RunsAndSubmissionContent = observer(() => {
  const { isAuthorized } = useAwaitAuthorization();
  const rootSpec = navigationStore.rootSpec;

  const legacySpec = rootSpec
    ? (deepClone(serializer.serialize(rootSpec)) as ComponentSpec)
    : undefined;

  if (!legacySpec) {
    return <EmptyState />;
  }

  const showMoreButton = rootSpec?.name ? (
    <RecentExecutionsButton
      pipelineName={rootSpec.name}
      trigger={
        <Button variant="ghost" size="xs" className="text-gray-700">
          Show all runs
        </Button>
      }
    />
  ) : null;

  return (
    <BlockStack fill inlineAlign="start">
      <BlockStack
        as="ul"
        gap="1"
        className="shrink-0 p-2"
        data-testid="runs-and-submission-buttons"
      >
        <li className="w-full">
          {isAuthorized ? (
            <OasisSubmitter
              componentSpec={legacySpec}
              isComponentTreeValid={rootSpec?.isValid}
              onlyFixableIssues={false}
            />
          ) : (
            <HuggingFaceAuthButton
              title="Sign in to Submit Runs"
              variant="default"
            />
          )}
        </li>

        {showGoogleSubmitter && legacySpec && (
          <li className="w-full">
            <GoogleCloudSubmissionDialog componentSpec={legacySpec} />
          </li>
        )}
      </BlockStack>
      <Separator />
      <BlockStack className="p-2">
        <InlineStack align="space-between" className="w-full">
          <Heading level={3}>The most recent run:</Heading>
          {showMoreButton}
        </InlineStack>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PipelineRunsList
            pipelineName={rootSpec?.name}
            showTitle={false}
            defaultShowingRuns={1}
            showMoreButton={false}
            overviewConfig={{
              showName: false,
              showDescription: true,
              showTaskStatusBar: false,
            }}
          />
        </div>
      </BlockStack>
    </BlockStack>
  );
});

function EmptyState() {
  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Icon name="FileQuestionMark" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        No pipeline loaded
      </Text>
    </BlockStack>
  );
}
