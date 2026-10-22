import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import useToastNotification from "@/hooks/useToastNotification";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";
import { extractCloneableTaskArguments } from "@/utils/nodes/taskArguments";

interface CloneVariables {
  componentSpec: ComponentSpec;
  runId: string | null | undefined;
  name: string;
  taskArguments: Record<string, string>;
}

export function useClonePipelineRun(
  componentSpec?: ComponentSpec,
  runId?: string | null,
) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const storage = usePipelineStorage();
  const { rootDetails } = useExecutionData();

  const { mutate: clonePipeline, isPending: isCloning } = useMutation({
    mutationFn: ({
      componentSpec,
      runId,
      name,
      taskArguments,
    }: CloneVariables) =>
      copyRunToPipeline(storage, componentSpec, runId, name, taskArguments),
    onSuccess: (result) => {
      if (!result?.url) return;
      notify(`Pipeline "${result.name}" cloned`, "success");
      navigate({ to: result.url });
    },
    onError: (error) => {
      notify(`Error cloning pipeline: ${error}`, "error");
    },
  });

  const clone = () => {
    if (!componentSpec) return;

    const taskSpecArguments = rootDetails?.task_spec.arguments ?? {};

    const taskArguments = extractCloneableTaskArguments(taskSpecArguments);

    const canonicalName = extractCanonicalName(
      buildTaskSpecShape(rootDetails?.task_spec, componentSpec),
    );
    const name = getInitialName(componentSpec, canonicalName);

    clonePipeline({
      componentSpec,
      runId,
      name,
      taskArguments,
    });
  };

  return { clone, isCloning };
}
