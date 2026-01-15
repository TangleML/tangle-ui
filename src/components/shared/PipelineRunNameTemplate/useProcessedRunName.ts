import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";

import { processTemplate } from "./processTemplate";
import { getRunNameTemplate } from "./utils";

/**
 * Hook that returns the processed run name from the ComponentSpec
 * with all placeholders resolved.
 *
 * Uses taskArguments from execution data if available, otherwise falls back
 * to ComponentSpec input values or defaults.
 *
 * @returns The processed run name string, or undefined if no run name template exists
 */
export function useProcessedRunName(): string | undefined {
  const { componentSpec } = useComponentSpec();
  const executionData = useExecutionDataOptional();
  const taskSpec = executionData?.rootDetails?.task_spec;

  const runNameTemplate = getRunNameTemplate(componentSpec);
  if (!runNameTemplate) {
    return undefined;
  }

  return processTemplate(runNameTemplate, {
    componentRef: {
      spec: componentSpec,
    },
    arguments: extractTaskArguments(taskSpec?.arguments),
    annotations: taskSpec?.annotations ?? {},
  });
}
