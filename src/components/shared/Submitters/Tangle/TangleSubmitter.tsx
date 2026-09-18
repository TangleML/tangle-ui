import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Loader2, SendHorizonal } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useCooldownTimer from "@/hooks/useCooldownTimer";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { useTourMockBackend } from "@/providers/TourProvider/tourMockBackend";
import { getDefaultRunPath } from "@/routes/runRoutes";
import type { PipelineRun } from "@/types/pipelineRun";
import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { validateArguments } from "@/utils/validations";

import TooltipButton from "../../Buttons/TooltipButton";
import { SubmitTaskArgumentsDialog } from "./components/SubmitTaskArgumentsDialog";
import { saveRunAnnotations } from "./saveRunAnnotations";
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

  const [submitSuccess, setSubmitSuccess] = useState<boolean | null>(null);
  const [isArgumentsDialogOpen, setIsArgumentsDialogOpen] = useState(false);
  const { cooldownTime, setCooldownTime } = useCooldownTimer(0);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const runNotes = useRef<string>("");

  const { mutate: saveAnnotations } = useMutation({
    mutationFn: (runId: string) =>
      saveRunAnnotations(runId, backendUrl, {
        notes: runNotes.current,
        componentSpec,
      }),
  });

  const handleError = (message: string) => {
    notify(message, "error");
  };

  const handleViewRun = (runId: number, e: MouseEvent) => {
    const href = getDefaultRunPath(runId);
    if (e.ctrlKey || e.metaKey) {
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

  const handleSubmit = async (taskArguments?: Record<string, ArgumentType>) => {
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
      setIsArgumentsDialogOpen(true);
      return;
    }

    setSubmitSuccess(null);
    submit({
      componentSpec,
      taskArguments,
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
    handleSubmit(args);
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
          onClick={() => handleSubmit()}
          className="flex-1 justify-start"
          variant="ghost"
          disabled={isButtonDisabled || !available}
        >
          {getButtonIcon()}
          <span className="font-normal text-xs">{getButtonText()}</span>
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
            onClick={() => setIsArgumentsDialogOpen(true)}
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
        />
      )}
    </>
  );
};

export default TangleSubmitter;
