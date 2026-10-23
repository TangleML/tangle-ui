import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Loader2, SendHorizonal } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";

import { RunProjectField } from "@/components/Project/RunProjectField";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { useMissingSecrets } from "@/components/shared/SecretsManagement/useMissingSecrets";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useCooldownTimer from "@/hooks/useCooldownTimer";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMockBackend } from "@/providers/TourProvider/tourMockBackend";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { actingTeamId, fallsBackToYou } from "@/services/teams/teamResolution";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";
import type { PipelineRun } from "@/types/pipelineRun";
import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { hasNewTabModifier } from "@/utils/dom";
import { validateArguments } from "@/utils/validations";

import TooltipButton from "../../Buttons/TooltipButton";
import { SubmitTaskArgumentsDialog } from "./components/SubmitTaskArgumentsDialog";
import { saveRunAnnotations } from "./saveRunAnnotations";
import { useRunAttribution } from "./useRunAttribution";
import { useSubmitPipeline } from "./useSubmitPipeline";

interface TangleSubmitterProps {
  componentSpec?: ComponentSpec;
  onSubmitComplete?: () => void;
  isComponentTreeValid?: boolean;
  onlyFixableIssues?: boolean;
}

const TangleSubmitter = ({
  componentSpec,
  onSubmitComplete,
  isComponentTreeValid = true,
  onlyFixableIssues = false,
}: TangleSubmitterProps) => {
  const { isAuthorized } = useAwaitAuthorization();
  const { backendUrl, configured, available } = useBackend();
  const mockBackend = useTourMockBackend();
  const { mutate: submit, isPending: isSubmitting } = useSubmitPipeline();
  const isAutoRedirect = useFlagValue("redirect-on-new-pipeline-run");
  const attribution = useRunAttribution();
  const pageTeam = useTeamForSubmission(attribution.defaultProjectIds);
  const chosenProjectsTeam = useTeamForSubmission(attribution.chosenProjectIds);
  const { missing: missingPageSecrets, isChecking: isCheckingPageSecrets } =
    useMissingSecrets(pageTeam, [componentSpec]);

  const [submitSuccess, setSubmitSuccess] = useState<boolean | null>(null);
  const [isArgumentsDialogOpen, setIsArgumentsDialogOpen] = useState(false);
  const { cooldownTime, setCooldownTime } = useCooldownTimer(0);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const runNotes = useRef<string>("");
  const runTeamId = useRef<string | undefined>(undefined);

  const { mutate: saveAnnotations } = useMutation({
    mutationFn: (runId: string) =>
      saveRunAnnotations(
        runId,
        backendUrl,
        {
          notes: runNotes.current,
          componentSpec,
        },
        runTeamId.current,
      ),
  });

  const handleError = (message: string) => {
    notify(message, "error");
  };

  const handleViewRun = (runId: number, e: MouseEvent) => {
    const href = getDefaultRunPath(runId);
    if (hasNewTabModifier(e)) {
      window.open(href, "_blank");
    } else {
      navigate({ to: href });
    }
  };

  const showSuccessNotification = (runId: number) => {
    const SuccessComponent = () => (
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Pipeline successfully submitted</span>
        </div>
        <Button
          onClick={(e: MouseEvent) => handleViewRun(runId, e)}
          className="w-full"
        >
          View Run
        </Button>
      </div>
    );
    notify(<SuccessComponent />, "success");
  };

  const onSuccess = (response: PipelineRun) => {
    saveAnnotations(response.id.toString());

    setSubmitSuccess(true);
    setCooldownTime(3);
    onSubmitComplete?.();
    showSuccessNotification(response.id);

    if (isAutoRedirect) {
      const href = getDefaultRunPath(response.id);
      window.open(href, "_blank");
    }
  };

  const onError = (error: Error | string) => {
    if (error instanceof Error) {
      handleError(`Failed to submit pipeline. ${error.message}`);
    } else {
      handleError(`Failed to submit pipeline. ${String(error)}`);
    }
    setSubmitSuccess(false);
    setCooldownTime(3);
  };

  const openArgumentsDialog = () => {
    attribution.resetToContext();
    setIsArgumentsDialogOpen(true);
  };

  const handleSubmit = async (
    taskArguments?: Record<string, ArgumentType>,
    runProjectIds: string[] = attribution.defaultProjectIds,
    teamId: string | undefined = actingTeamId(pageTeam),
  ) => {
    if (!componentSpec) {
      handleError("No pipeline to submit");
      return;
    }

    if (!isComponentTreeValid && !onlyFixableIssues) {
      handleError(
        `Pipeline validation failed. Refer to details panel for more info.`,
      );
      return;
    }

    if (
      onlyFixableIssues &&
      !validateArguments(componentSpec.inputs ?? [], taskArguments ?? {})
    ) {
      openArgumentsDialog();
      return;
    }

    setSubmitSuccess(null);
    runTeamId.current = teamId;
    submit({
      componentSpec,
      taskArguments,
      projectIds: runProjectIds,
      teamId,
      onSuccess,
      onError,
    });
  };

  const handleSubmitWithArguments = (
    args: Record<string, ArgumentType>,
    notes: string,
  ) => {
    runNotes.current = notes;
    setIsArgumentsDialogOpen(false);
    handleSubmit(
      args,
      attribution.chosenProjectIds,
      actingTeamId(chosenProjectsTeam),
    );
  };

  const pageTeamNeedsReview =
    fallsBackToYou(pageTeam) || missingPageSecrets.length > 0;

  const handleQuickSubmit = () => {
    if (pageTeamNeedsReview) {
      openArgumentsDialog();
      return;
    }
    handleSubmit();
  };

  const hasConfigurableInputs = (componentSpec?.inputs?.length ?? 0) > 0;

  const getButtonText = () => {
    if (cooldownTime > 0) {
      return `Run submitted (${cooldownTime}s)`;
    }
    if (!isAuthorized) {
      return "Sign in to Submit runs";
    }

    return "Submit Run";
  };

  const isSubmittable =
    componentSpec &&
    isAuthorized &&
    (isComponentTreeValid || onlyFixableIssues) &&
    cooldownTime === 0 &&
    isGraphImplementation(componentSpec.implementation) &&
    Object.keys(componentSpec.implementation.graph.tasks).length > 0;

  const isPageTeamUnsettled =
    pageTeam.status === "resolving" ||
    pageTeam.status === "conflict" ||
    isCheckingPageSecrets;

  const isButtonDisabled = isSubmitting || !isSubmittable;

  const isArgumentsButtonVisible =
    hasConfigurableInputs && !isButtonDisabled && isComponentTreeValid;

  const getButtonIcon = () => {
    if (isSubmitting) {
      return <Loader2 className="animate-spin" />;
    }
    if (submitSuccess === false && cooldownTime > 0) {
      return <AlertCircle />;
    }
    if (submitSuccess === true && cooldownTime > 0) {
      return <CheckCircle />;
    }
    if (!isComponentTreeValid && onlyFixableIssues) {
      return <Icon name="Split" className="rotate-90" />;
    }
    return <SendHorizonal />;
  };

  return (
    <>
      <InlineStack align="space-between" className="pr-2.5">
        <Button
          onClick={handleQuickSubmit}
          className="flex-1 justify-start"
          variant="ghost"
          disabled={isButtonDisabled || isPageTeamUnsettled || !available}
        >
          {getButtonIcon()}
          <span className="font-normal text-xs">{getButtonText()}</span>
          {pageTeam.status === "active" && cooldownTime === 0 && (
            <div
              className="text-xs font-light -ml-1 text-muted-foreground truncate"
              data-testid="submit-as-team"
            >
              {"as "}
              <TeamName team={pageTeam.team} />
            </div>
          )}
          {pageTeam.status === "conflict" && (
            <div className="text-xs font-light -ml-1 text-destructive">
              (projects on different teams)
            </div>
          )}
          {!isComponentTreeValid && !onlyFixableIssues && (
            <div
              className={cn(
                "text-xs font-light -ml-1",
                configured ? "text-destructive" : "text-warning",
              )}
            >
              (has validation issues)
            </div>
          )}
          {!available && (
            <div
              className={cn(
                "text-xs font-light -ml-1",
                configured ? "text-destructive" : "text-warning",
              )}
            >
              {`(backend ${configured ? "unavailable" : "unconfigured"})`}
            </div>
          )}
        </Button>
        {isArgumentsButtonVisible && (
          <TooltipButton
            tooltip="Submit run with arguments"
            variant="ghost"
            size="icon"
            data-testid="run-with-arguments-button"
            onClick={openArgumentsDialog}
            disabled={!available && !mockBackend}
          >
            <Icon name="Split" className="rotate-90" />
          </TooltipButton>
        )}
      </InlineStack>

      {componentSpec && (
        <SubmitTaskArgumentsDialog
          open={isArgumentsDialogOpen}
          onCancel={() => setIsArgumentsDialogOpen(false)}
          onConfirm={handleSubmitWithArguments}
          componentSpec={componentSpec}
          team={chosenProjectsTeam}
          projectField={
            <RunProjectField
              pipelineName={componentSpec.name}
              value={attribution.projectId}
              onChange={attribution.setProjectId}
            />
          }
        />
      )}
    </>
  );
};

export default TangleSubmitter;
