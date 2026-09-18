import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { SubmitTaskArgumentsDialog } from "@/components/shared/Submitters/Tangle/components/SubmitTaskArgumentsDialog";
import { saveRunAnnotations } from "@/components/shared/Submitters/Tangle/saveRunAnnotations";
import { useSubmitPipeline } from "@/components/shared/Submitters/Tangle/useSubmitPipeline";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { tracking } from "@/utils/tracking";

import { pipelineValidity } from "./pipelineValidity";

interface RunPipelineButtonProps {
  projectId: string;
  spec: ComponentSpec;
  heldInThisBrowser?: boolean;
}

export function RunPipelineButton({
  projectId,
  spec,
  heldInThisBrowser = false,
}: RunPipelineButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { backendUrl, available } = useBackend();
  const { mutate: submit, isPending } = useSubmitPipeline();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const { mutate: saveAnnotations } = useMutation({
    mutationFn: ({ runId, notes }: { runId: string; notes: string }) =>
      saveRunAnnotations(runId, backendUrl, { notes, componentSpec: spec }),
  });

  const runnable = pipelineValidity(spec) !== "invalid";

  const run = (taskArguments: Record<string, ArgumentType>, notes: string) => {
    setDialogOpen(false);
    submit({
      componentSpec: spec,
      taskArguments,
      projectIds: [projectId],
      onSuccess: (run: PipelineRun) => {
        saveAnnotations({ runId: run.id.toString(), notes });
        track("projects.run_pipeline_completed", {});
        notify("Run started in this project", "success");
      },
      onError: (error) => {
        notify(
          `Failed to start the run. ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      },
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={isPending || !runnable || !available}
        title={
          runnable
            ? undefined
            : "This pipeline does not validate, so it cannot be run."
        }
        {...tracking("projects.run_pipeline_open")}
      >
        <Icon name="Play" size="xs" />
        Run pipeline
      </Button>

      {dialogOpen && (
        <SubmitTaskArgumentsDialog
          open
          onCancel={() => setDialogOpen(false)}
          onConfirm={run}
          componentSpec={spec}
          showCopyFromRun={heldInThisBrowser}
        />
      )}
    </>
  );
}
