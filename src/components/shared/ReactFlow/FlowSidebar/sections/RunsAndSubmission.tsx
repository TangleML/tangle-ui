import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { HuggingFaceAuthButton } from "@/components/shared/HuggingFaceAuth/HuggingFaceAuthButton";
import GoogleCloudSubmissionDialog from "@/components/shared/Submitters/GoogleCloud/GoogleCloudSubmissionDialog";
import OasisSubmitter from "@/components/shared/Submitters/Oasis/OasisSubmitter";
import { BlockStack } from "@/components/ui/layout";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { env } from "@/schemas/env";
import { isFixableIssue } from "@/utils/validations";

import { RecentExecutionsButton } from "../components/RecentExecutionsButton";
import { SidebarSection } from "../components/SidebarSection";

const RunsAndSubmission = () => {
  const { isAuthorized } = useAwaitAuthorization();
  const { componentSpec, isComponentTreeValid, globalValidationIssues } =
    useComponentSpec();

  const onlyFixableIssues =
    globalValidationIssues.filter(isFixableIssue).length ===
    globalValidationIssues.length;

  const showGoogleSubmitter = env.VITE_ENABLE_GOOGLE_CLOUD_SUBMITTER;

  return (
    <SidebarSection
      title="Runs & Submissions"
      headerAction={<RecentExecutionsButton />}
    >
      <BlockStack as="ul" gap="1">
        <li className="w-full">
          {isAuthorized ? (
            <OasisSubmitter
              componentSpec={componentSpec}
              isComponentTreeValid={isComponentTreeValid}
              onlyFixableIssues={onlyFixableIssues}
            />
          ) : (
            <HuggingFaceAuthButton
              title="Sign in to Submit Runs"
              variant="default"
            />
          )}
        </li>

        {showGoogleSubmitter && (
          <li className="w-full">
            <GoogleCloudSubmissionDialog componentSpec={componentSpec} />
          </li>
        )}
      </BlockStack>
    </SidebarSection>
  );
};

export default RunsAndSubmission;
