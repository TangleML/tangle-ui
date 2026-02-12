import { isPipelineAggregator } from "./annotations";
import type { ComponentSpec, TaskSpec, ContainerImplementation } from "./componentSpec";
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
  const aggregatorInputs = inputs.filter((input) =>
    input.name.startsWith("agg_"),
  );

  if (aggregatorInputs.length === 0) {
    return taskSpec;
  }

  // Get output_type from the output_type input argument
  const outputType = (taskSpec.arguments?.["output_type"] as string) || 'JsonArray';

  // Create a new implementation with dynamic args for each agg_* input
  const containerImpl = spec.implementation as ContainerImplementation;
  if (!containerImpl?.container) {
    return taskSpec;
  }

  // Build args array with individual input references
  const args: any[] = [];
  
  // Add output-type argument
  args.push('--output-type', outputType);
  
  // Add each aggregator input
  aggregatorInputs.forEach((input) => {
    const argName = `--${input.name.replace(/_/g, '-')}`;
    args.push(argName, { inputValue: input.name });
  });
  
  // Add output path
  args.push('----output-paths', { outputPath: 'Output' });

  const updatedSpec: ComponentSpec = {
    ...spec,
    implementation: {
      ...containerImpl,
      container: {
        ...containerImpl.container,
        args,
      },
    },
  };

  return {
    ...taskSpec,
    componentRef: {
      ...taskSpec.componentRef,
      spec: updatedSpec,
    },
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
