import { isPipelineAggregator } from "./annotations";
import type { ComponentSpec, TaskSpec } from "./componentSpec";
import { isGraphImplementation } from "./componentSpec";

export const transformAggregatorTaskSpec = (taskSpec: TaskSpec): TaskSpec => {
  if (
    !isPipelineAggregator(taskSpec.componentRef?.spec?.metadata?.annotations)
  ) {
    return taskSpec;
  }

  const spec = taskSpec.componentRef?.spec;
  if (!spec) return taskSpec;

  const inputs = spec.inputs || [];
  const aggregatorInputs = inputs.filter((input) => input.name.match(/^\d+$/));

  if (aggregatorInputs.length === 0) {
    return taskSpec;
  }

  const aggregatedData = aggregatorInputs
    .map((input) => {
      const value = taskSpec.arguments?.[input.name];
      return value ? JSON.stringify(value) : null;
    })
    .filter((v) => v !== null);

  const mergedInput = `[${aggregatedData.join(",")}]`;

  const newArguments = { ...taskSpec.arguments };
  aggregatorInputs.forEach((input) => {
    delete newArguments[input.name];
  });
  newArguments.aggregated_inputs = mergedInput;

  return {
    ...taskSpec,
    arguments: newArguments,
  };
};

export const transformAggregatorComponentSpec = (
  componentSpec: ComponentSpec,
): ComponentSpec => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return componentSpec;
  }

  const graphImpl = componentSpec.implementation;
  if (!graphImpl.graph?.tasks) {
    return componentSpec;
  }

  const transformedTasks = Object.entries(graphImpl.graph.tasks).reduce(
    (acc, [taskId, taskSpec]) => {
      acc[taskId] = transformAggregatorTaskSpec(taskSpec as TaskSpec);
      return acc;
    },
    {} as Record<string, TaskSpec>,
  );

  return {
    ...componentSpec,
    implementation: {
      ...graphImpl,
      graph: {
        ...graphImpl.graph,
        tasks: transformedTasks,
      },
    },
  };
};
