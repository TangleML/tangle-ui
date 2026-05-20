import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { HuggingFaceAuthButton } from "@/components/shared/HuggingFaceAuth/HuggingFaceAuthButton";
import GoogleCloudSubmissionDialog from "@/components/shared/Submitters/GoogleCloud/GoogleCloudSubmissionDialog";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { ENABLE_GOOGLE_CLOUD_SUBMITTER } from "@/utils/constants";
import { deepClone } from "@/utils/deepClone";

export const RunsAndSubmissionContent = observer(() => {
  const { isAuthorized } = useAwaitAuthorization();
  const { navigation } = useSharedStores();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;

  const serializedRootPipelineSpec = rootSpec
    ? deepClone(serializeComponentSpec(rootSpec))
    : undefined;

  if (!serializedRootPipelineSpec) {
    return <EmptyState />;
  }

  return (
    <BlockStack
      fill
      className="min-h-0 overflow-y-auto"
      inlineAlign="start"
      gap="1"
    >
      <BlockStack
        fill
        align="stretch"
        gap="1"
        className="min-h-0 overflow-y-auto p-2"
        data-testid="runs-and-submission-buttons"
      >
        {isAuthorized ? (
          <TangleSubmitter
            componentSpec={serializedRootPipelineSpec}
            isComponentTreeValid={rootSpec?.isValid}
            onlyFixableIssues={!hasErrors && allIssues.length > 0}
          />
        ) : (
          <HuggingFaceAuthButton
            title="Sign in to Submit Runs"
            variant="default"
          />
        )}

        {ENABLE_GOOGLE_CLOUD_SUBMITTER && (
          <GoogleCloudSubmissionDialog
            componentSpec={serializedRootPipelineSpec}
          />
        )}
      </BlockStack>
    </BlockStack>
  );
});

function EmptyState() {
  return (
    <BlockStack fill className="p-4" inlineAlign="center" align="center">
      <Icon name="FileQuestionMark" size="lg" tone="weak" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        No pipeline loaded
      </Text>
    </BlockStack>
  );
}
