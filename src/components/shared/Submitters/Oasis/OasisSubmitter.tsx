import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { APP_ROUTES } from "@/routes/router";
import { updateRunAnnotation } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import {
  getPipelineTagsFromSpec,
  PIPELINE_RUN_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotations";
import { expandBulkArguments } from "@/utils/bulkSubmission";
import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";
import { validateArguments } from "@/utils/validations";

import { isAuthorizationRequired } from "../../Authentication/helpers";
import { useAuthLocalStorage } from "../../Authentication/useAuthLocalStorage";
import TooltipButton from "../../Buttons/TooltipButton";
import { SubmitTaskArgumentsDialog } from "./components/SubmitTaskArgumentsDialog";

interface OasisSubmitterProps {
  componentSpec?: ComponentSpec;
  onSubmitComplete?: () => void;
  isComponentTreeValid?: boolean;
  onlyFixableIssues?: boolean;
}

function useSubmitPipeline() {
  const runNameOverride = useFlagValue("templatized-pipeline-run-name");
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
      taskArguments?: Record<string, ArgumentType>;
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
          runNameOverride,
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
  onlyFixableIssues = false,
}: OasisSubmitterProps) => {
  const { isAuthorized } = useAwaitAuthorization();
  const { backendUrl, configured, available } = useBackend();
  const { mutate: submit, isPending: isSubmitting } = useSubmitPipeline();
  const isAutoRedirect = useFlagValue("redirect-on-new-pipeline-run");

  const [submitSuccess, setSubmitSuccess] = useState<boolean | null>(null);
  const [isArgumentsDialogOpen, setIsArgumentsDialogOpen] = useState(false);
  const { cooldownTime, setCooldownTime } = useCooldownTimer(0);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const runNotes = useRef<string>("");
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  const { mutate: saveNotes } = useMutation({
    mutationFn: (runId: string) =>
      updateRunAnnotation(runId, backendUrl, {
        key: PIPELINE_RUN_NOTES_ANNOTATION,
        value: runNotes.current,
      }),
  });

  const { mutate: saveTags } = useMutation({
    mutationFn: (runId: string) =>
      updateRunAnnotation(runId, backendUrl, {
        key: PIPELINE_TAGS_ANNOTATION,
        value: getPipelineTagsFromSpec(componentSpec).join(","),
      }),
  });

  const handleError = (message: string) => {
    notify(message, "error");
  };

  const handleViewRun = (runId: number, e: MouseEvent) => {
    const href = `${APP_ROUTES.RUNS}/${runId}`;
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
    if (runNotes.current.trim() !== "") {
      saveNotes(response.id.toString());
    }

    const tags = getPipelineTagsFromSpec(componentSpec);
    if (tags.length > 0) {
      saveTags(response.id.toString());
    }

    setSubmitSuccess(true);
    setCooldownTime(3);
    onSubmitComplete?.();
    showSuccessNotification(response.id);

    if (isAutoRedirect) {
      const href = `${APP_ROUTES.RUNS}/${response.id}`;
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

  const handleBulkSubmit = async (argSets: Record<string, ArgumentType>[]) => {
    if (!componentSpec) {
      handleError("No pipeline to submit");
      return;
    }

    const total = argSets.length;
    setBulkProgress({ total, completed: 0, failed: 0 });
    setSubmitSuccess(null);

    let completed = 0;
    let failed = 0;

    for (const args of argSets) {
      try {
        const response = await new Promise<PipelineRun>((resolve, reject) => {
          submit({
            componentSpec,
            taskArguments: args,
            onSuccess: resolve,
            onError: reject,
          });
        });

        if (runNotes.current.trim() !== "") {
          saveNotes(response.id.toString());
        }

        const tags = getPipelineTagsFromSpec(componentSpec);
        if (tags.length > 0) {
          saveTags(response.id.toString());
        }

        completed++;
      } catch {
        failed++;
      }

      setBulkProgress({ total, completed, failed });
    }

    setBulkProgress(null);
    setSubmitSuccess(failed === 0);
    setCooldownTime(3);

    if (failed === 0) {
      onSubmitComplete?.();
      notify(`${total} runs submitted successfully`, "success");
    } else {
      notify(
        `${completed} of ${total} runs submitted. ${failed} failed.`,
        failed === total ? "error" : "warning",
      );
    }
  };

  const handleSubmitWithArguments = async (
    args: Record<string, ArgumentType>,
    notes: string,
    bulkInputNames: Set<string>,
  ) => {
    runNotes.current = notes;
    setIsArgumentsDialogOpen(false);

    if (bulkInputNames.size === 0) {
      handleSubmit(args);
      return;
    }

    try {
      const argSets = expandBulkArguments(args, bulkInputNames);
      await handleBulkSubmit(argSets);
    } catch (error) {
      notify(`Bulk submission failed: ${String(error)}`, "error");
    }
  };

  const hasConfigurableInputs = (componentSpec?.inputs?.length ?? 0) > 0;

  const getButtonText = () => {
    if (bulkProgress) {
      const current = bulkProgress.completed + bulkProgress.failed;
      return `Submitting ${current + 1} of ${bulkProgress.total}...`;
    }
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

  const isBulkSubmitting = bulkProgress !== null;
  const isButtonDisabled = isSubmitting || isBulkSubmitting || !isSubmittable;

  const isArgumentsButtonVisible =
    hasConfigurableInputs && !isButtonDisabled && isComponentTreeValid;

  const getButtonIcon = () => {
    if (isSubmitting || isBulkSubmitting) {
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
