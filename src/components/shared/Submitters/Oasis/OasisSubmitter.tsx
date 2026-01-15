import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, Loader2, SendHorizonal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import type { TaskSpecOutput } from "@/api/types.gen";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useCooldownTimer from "@/hooks/useCooldownTimer";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/router";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { isAuthorizationRequired } from "../../Authentication/helpers";
import { useAuthLocalStorage } from "../../Authentication/useAuthLocalStorage";
import TooltipButton from "../../Buttons/TooltipButton";
import { SubmitTaskArgumentsDialog } from "./components/SubmitTaskArgumentsDialog";

interface OasisSubmitterProps {
  componentSpec?: ComponentSpec;
  onSubmitComplete?: () => void;
  isComponentTreeValid?: boolean;
}

function useSubmitPipeline() {
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const queryClient = useQueryClient();
  const { getToken } = useAuthLocalStorage();

  const { backendUrl } = useBackend();

  const authorizationToken = useRef<string | undefined>(getToken());

  return useMutation({
    mutationFn: async ({
      componentSpec,
      taskArguments,
      onSuccess,
      onError,
    }: {
      componentSpec: ComponentSpec;
      taskArguments?: TaskSpecOutput["arguments"];
      onSuccess: (data: PipelineRun) => void;
      onError: (error: Error | string) => void;
    }) => {
      const authorizationRequired = isAuthorizationRequired();
      if (authorizationRequired && !isAuthorized) {
        const token = await awaitAuthorization();
        if (token) {
          authorizationToken.current = token;
        }
      }

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          authorizationToken: authorizationToken.current,
          taskArguments,
          onSuccess: (data) => {
            resolve(data);
            onSuccess(data);
          },
          onError: (error) => {
            reject(error);
            onError(error);
          },
        });
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["pipelineRuns"],
      });
    },
  });
}

const OasisSubmitter = ({
  componentSpec,
  onSubmitComplete,
  isComponentTreeValid = true,
}: OasisSubmitterProps) => {
  const { isAuthorized } = useAwaitAuthorization();
  const { configured, available } = useBackend();
  const { mutate: submit, isPending: isSubmitting } = useSubmitPipeline();
  const isAutoRedirect = useBetaFlagValue("redirect-on-new-pipeline-run");

  const [submitSuccess, setSubmitSuccess] = useState<boolean | null>(null);
  const [isArgumentsDialogOpen, setIsArgumentsDialogOpen] = useState(false);
  const { cooldownTime, setCooldownTime } = useCooldownTimer(0);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const handleError = useCallback(
    (message: string) => {
      notify(message, "error");
    },
    [notify],
  );

  const handleViewRun = useCallback(
    (runId: number, newTab = false) => {
      const href = `${APP_ROUTES.RUNS}/${runId}`;
      if (newTab) {
        window.open(href, "_blank");
      } else {
        navigate({ to: href });
      }
    },
    [navigate],
  );

  const showSuccessNotification = useCallback(
    (runId: number) => {
      const SuccessComponent = () => (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Pipeline successfully submitted
            </span>
          </div>
          <Button onClick={() => handleViewRun(runId)} className="w-full">
            View Run
          </Button>
        </div>
      );
      notify(<SuccessComponent />, "success");
    },
    [notify, handleViewRun],
  );

  const onSuccess = useCallback(
    (response: PipelineRun) => {
      setSubmitSuccess(true);
      setCooldownTime(3);
      onSubmitComplete?.();
      showSuccessNotification(response.id);

      if (isAutoRedirect) {
        handleViewRun(response.id, true);
      }
    },
    [
      setCooldownTime,
      onSubmitComplete,
      showSuccessNotification,
      isAutoRedirect,
      handleViewRun,
    ],
  );

  const onError = useCallback(
    (error: Error | string) => {
      if (error instanceof Error) {
        handleError(`Failed to submit pipeline. ${error.message}`);
      } else {
        handleError(`Failed to submit pipeline. ${String(error)}`);
      }
      setSubmitSuccess(false);
      setCooldownTime(3);
    },
    [handleError, setCooldownTime],
  );

  const handleSubmit = useCallback(
    async (taskArguments?: Record<string, string>) => {
      if (!componentSpec) {
        handleError("No pipeline to submit");
        return;
      }

      if (!isComponentTreeValid) {
        handleError(
          `Pipeline validation failed. Refer to details panel for more info.`,
        );
        return;
      }

      setSubmitSuccess(null);
      submit({
        componentSpec,
        taskArguments,
        onSuccess,
        onError,
      });
    },
    [
      handleError,
      submit,
      componentSpec,
      isComponentTreeValid,
      onSuccess,
      onError,
    ],
  );

  const handleSubmitWithArguments = useCallback(
    (args: Record<string, string>) => {
      setIsArgumentsDialogOpen(false);
      handleSubmit(args);
    },
    [handleSubmit],
  );

  const hasConfigurableInputs = useMemo(
    () => (componentSpec?.inputs?.length ?? 0) > 0,
    [componentSpec?.inputs],
  );

  const getButtonText = () => {
    if (cooldownTime > 0) {
      return `Run submitted (${cooldownTime}s)`;
    }
    if (!isAuthorized) {
      return "Sign in to Submit runs";
    }

    return "Submit Run";
  };

  const isButtonDisabled =
    isSubmitting ||
    !componentSpec ||
    !isAuthorized ||
    !isComponentTreeValid ||
    cooldownTime > 0 ||
    ("graph" in componentSpec.implementation &&
      Object.keys(componentSpec.implementation.graph.tasks).length === 0);

  const isArgumentsButtonVisible = hasConfigurableInputs && !isButtonDisabled;

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
          {!isComponentTreeValid && (
            <div
              className={cn(
                "text-xs font-light -ml-1",
                configured ? "text-red-700" : "text-yellow-700",
              )}
            >
              (has validation issues)
            </div>
          )}
          {!available && (
            <div
              className={cn(
                "text-xs font-light -ml-1",
                configured ? "text-red-700" : "text-yellow-700",
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
            disabled={!available}
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

export default OasisSubmitter;
