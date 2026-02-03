import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { HuggingFaceAuthButton } from "@/components/shared/HuggingFaceAuth/HuggingFaceAuthButton";
import GoogleCloudSubmissionDialog from "@/components/shared/Submitters/GoogleCloud/GoogleCloudSubmissionDialog";
import OasisSubmitter from "@/components/shared/Submitters/Oasis/OasisSubmitter";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { isFixableIssue } from "@/utils/validations";

import { RecentExecutionsButton } from "../components/RecentExecutionsButton";

const RunsAndSubmission = ({ isOpen }: { isOpen: boolean }) => {
  const { isAuthorized } = useAwaitAuthorization();
  const { componentSpec, isComponentTreeValid, globalValidationIssues } =
    useComponentSpec();

  const onlyFixableIssues =
    globalValidationIssues.filter(isFixableIssue).length ===
    globalValidationIssues.length;

  const showGoogleSubmitter =
    import.meta.env.VITE_ENABLE_GOOGLE_CLOUD_SUBMITTER === "true";

  if (!isOpen) {
    return (
      <>
        <hr />
        <SidebarGroupContent className="mx-2! my-2!">
          <SidebarMenu>
            <SidebarMenuItem>
              {isAuthorized ? (
                <OasisSubmitter
                  componentSpec={componentSpec}
                  isComponentTreeValid={isComponentTreeValid}
                  onlyFixableIssues={onlyFixableIssues}
                />
              ) : (
                <HuggingFaceAuthButton title="Sign in to Submit Runs" />
              )}
            </SidebarMenuItem>
            {showGoogleSubmitter && (
              <SidebarMenuItem>
                <GoogleCloudSubmissionDialog componentSpec={componentSpec} />
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <RecentExecutionsButton tooltipPosition="right" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <div className="flex items-center justify-between gap-2 w-full">
          <div>Runs & Submissions</div>
          <RecentExecutionsButton />
        </div>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      <SidebarGroupContent
        className={cn({
          hidden: !isOpen,
          "mt-2": true,
        })}
      >
        <SidebarMenu>
          {showGoogleSubmitter && (
            <SidebarMenuItem>
              <GoogleCloudSubmissionDialog componentSpec={componentSpec} />
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default RunsAndSubmission;
