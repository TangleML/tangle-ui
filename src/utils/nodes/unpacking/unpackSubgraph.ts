import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { extractPositionFromAnnotations } from "@/utils/nodes/extractPositionFromAnnotations";

import {
  copyOutputValues,
  unpackInputs,
  unpackOutputs,
  unpackTasks,
} from "./helpers";

export const unpackSubgraph = (
  subgraphTaskId: string,
  componentSpec: ComponentSpec,
): ComponentSpec => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return componentSpec;
  }

  const graphSpec = componentSpec.implementation.graph;
  const taskSpec = graphSpec.tasks[subgraphTaskId];
  const subgraphSpec = taskSpec.componentRef.spec;

  if (!subgraphSpec) {
    return componentSpec;
  }

  const subgraphPosition = extractPositionFromAnnotations(taskSpec.annotations);

  let updatedComponentSpec = componentSpec;

  // Unpack inputs
  const { spec: specAfterInputs, inputNameMap } = unpackInputs(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
  );
  updatedComponentSpec = specAfterInputs;

  // Unpack outputs
  const { spec: specAfterOutputs, outputNameMap } = unpackOutputs(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
  );
  updatedComponentSpec = specAfterOutputs;

  // Unpack tasks
  const { spec: specAfterTasks, taskIdMap } = unpackTasks(
    subgraphSpec,
    subgraphPosition,
    updatedComponentSpec,
    inputNameMap,
  );
  updatedComponentSpec = specAfterTasks;

  // Copy output values
  updatedComponentSpec = copyOutputValues(
    subgraphSpec,
    updatedComponentSpec,
    outputNameMap,
    taskIdMap,
  );

  return updatedComponentSpec;
};
