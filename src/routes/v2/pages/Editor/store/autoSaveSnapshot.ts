import { isFlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  type ComponentSpec,
  serializeComponentSpec,
} from "@/models/componentSpec";
import type { EdgeConduit } from "@/models/componentSpec/annotations";
import {
  EDGE_CONDUITS_ANNOTATION,
  EDITOR_POSITION_ANNOTATION,
  FLEX_NODES_ANNOTATION,
} from "@/utils/annotationKeys";
import {
  type ComponentSpec as ComponentSpecJson,
  isGraphImplementation,
  type TaskSpec,
} from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";
import { componentSpecToText } from "@/utils/yaml";

export interface AutoSaveSnapshot {
  yaml: string;
  contentKey: string;
}

function withoutNodePosition(annotations?: Record<string, unknown>) {
  if (!annotations) return undefined;
  const remaining = Object.fromEntries(
    Object.entries(annotations).filter(
      ([key]) => key !== EDITOR_POSITION_ANNOTATION,
    ),
  );
  return Object.keys(remaining).length > 0 ? remaining : undefined;
}

function isEdgeConduit(value: unknown): value is EdgeConduit {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.orientation === "horizontal" || value.orientation === "vertical") &&
    typeof value.coordinate === "number" &&
    typeof value.color === "string" &&
    Array.isArray(value.edgeIds) &&
    value.edgeIds.every((id: unknown) => typeof id === "string")
  );
}

function withoutEmbeddedPositions(key: string, value: unknown): unknown {
  if (key !== FLEX_NODES_ANNOTATION && key !== EDGE_CONDUITS_ANNOTATION)
    return value;
  let nodes: unknown = value;
  if (typeof value === "string") {
    try {
      nodes = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!Array.isArray(nodes)) return value;
  if (key === FLEX_NODES_ANNOTATION && nodes.every(isFlexNodeData))
    return JSON.stringify(nodes.map(({ position: _, ...node }) => node));
  if (key === EDGE_CONDUITS_ANNOTATION && nodes.every(isEdgeConduit))
    return JSON.stringify(nodes.map(({ coordinate: _, ...node }) => node));
  return value;
}

function withoutTaskPositions(task: TaskSpec): TaskSpec {
  return {
    ...task,
    annotations: withoutNodePosition(task.annotations),
    componentRef: task.componentRef.spec
      ? {
          ...task.componentRef,
          spec: withoutPositions(task.componentRef.spec),
        }
      : task.componentRef,
  };
}

function withoutPositions(spec: ComponentSpecJson): ComponentSpecJson {
  return {
    ...spec,
    inputs: spec.inputs?.map((input) => ({
      ...input,
      annotations: withoutNodePosition(input.annotations),
    })),
    outputs: spec.outputs?.map((output) => ({
      ...output,
      annotations: withoutNodePosition(output.annotations),
    })),
    metadata: spec.metadata && {
      ...spec.metadata,
      annotations:
        spec.metadata.annotations &&
        Object.fromEntries(
          Object.entries(spec.metadata.annotations).map(([key, value]) => [
            key,
            withoutEmbeddedPositions(key, value),
          ]),
        ),
    },
    implementation: isGraphImplementation(spec.implementation)
      ? {
          ...spec.implementation,
          graph: {
            ...spec.implementation.graph,
            tasks: Object.fromEntries(
              Object.entries(spec.implementation.graph.tasks).map(
                ([name, task]) => [name, withoutTaskPositions(task)],
              ),
            ),
          },
        }
      : spec.implementation,
  };
}

export function getAutoSaveSnapshot(spec: ComponentSpec): AutoSaveSnapshot {
  const serialized = serializeComponentSpec(spec);
  return {
    yaml: componentSpecToText(serialized),
    contentKey: JSON.stringify(withoutPositions(serialized)),
  };
}
