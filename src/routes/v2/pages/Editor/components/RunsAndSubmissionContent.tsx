import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { HuggingFaceAuthButton } from "@/components/shared/HuggingFaceAuth/HuggingFaceAuthButton";
import GoogleCloudSubmissionDialog from "@/components/shared/Submitters/GoogleCloud/GoogleCloudSubmissionDialog";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack } from "@/components/ui/layout";
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
    return (
      <EmptyState icon="FileQuestionMark" description="No pipeline loaded" />
    );
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
