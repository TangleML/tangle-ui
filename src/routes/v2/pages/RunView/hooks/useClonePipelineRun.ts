import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import useToastNotification from "@/hooks/useToastNotification";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import {
  type ArgumentType,
  type ComponentSpec,
  isSecretArgument,
} from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";

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
  const { rootDetails } = useExecutionData();

  const { mutate: clonePipeline, isPending: isCloning } = useMutation({
    mutationFn: ({
      componentSpec,
      runId,
      name,
      taskArguments,
    }: CloneVariables) =>
      copyRunToPipeline(componentSpec, runId, name, taskArguments),
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

    /**
     * SecretArguments cannot be converted into strings compatible with inputs,
     * so drop them from the cloned pipeline's arguments.
     */
    const secretArgumentKeys = new Set(
      Object.entries(taskSpecArguments)
        .filter(([, value]) => isSecretArgument(value as ArgumentType))
        .map(([key]) => key),
    );

    const plainTaskArguments = extractTaskArguments(taskSpecArguments);
    const taskArguments: Record<string, string> = Object.fromEntries(
      Object.entries(plainTaskArguments).filter(
        ([key]) => !secretArgumentKeys.has(key),
      ),
    );

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
