import type { TaskNodeViewProps } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import { AggregatorOutputType } from "@/types/aggregator";
import { isGraphImplementation } from "@/utils/componentSpec";
import { componentSpecFromYaml } from "@/utils/yaml";

const noop = () => {};

/**
 * Maps raw component YAML into the pure-data props consumed by the v2
 * TaskNodeCard, so a single isolated component can be previewed without the
 * editor's MobX spec model or ReactFlow node context.
 */
export function buildPreviewTaskNodeViewProps(
  componentText: string,
): TaskNodeViewProps | null {
  let spec;
  try {
    spec = componentSpecFromYaml(componentText);
  } catch {
    return null;
  }

  return {
    id: "preview",
    entityId: "preview",
    taskName: spec.name ?? "component-preview",
    selected: false,
    isHovered: false,
    isSubgraph: isGraphImplementation(spec.implementation),
    collapsed: false,
    description: spec.description ?? "",
    inputs: (spec.inputs ?? []).map((input) => ({
      name: input.name,
      type: input.type,
      optional: input.optional,
      default: input.default,
    })),
    outputs: (spec.outputs ?? []).map((output) => ({
      name: output.name,
      type: output.type,
    })),
    connectedInputNames: new Set<string>(),
    connectedOutputNames: new Set<string>(),
    annotations: [],
    taskColor: undefined,
    cacheDisabled: false,
    digest: undefined,
    inputDisplayValues: {},
    isAggregator: false,
    outputType: AggregatorOutputType.JsonArray,
    onOutputTypeChange: noop,
    onNodeClick: noop,
    onInputClick: noop,
    onOutputClick: noop,
    onHandleClick: noop,
  };
}
