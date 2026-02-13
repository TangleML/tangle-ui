import type { TaskSpecOutput } from "@/api/types.gen";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";

export interface TaskSpecShape {
  componentRef: Omit<ComponentReference, "spec"> & {
    spec: ComponentSpec;
  };
  arguments?: Record<string, string> | null;
  annotations?: Record<string, unknown> | null;
}

export function buildTaskSpecShape(
  taskSpecOutput: TaskSpecOutput | undefined,
  componentSpec: ComponentSpec,
): TaskSpecShape | undefined {
  if (!taskSpecOutput) {
    return undefined;
  }

  return {
    componentRef: {
      spec: componentSpec,
    },
    arguments: extractTaskArguments(taskSpecOutput.arguments),
    annotations: taskSpecOutput.annotations,
  };
}
