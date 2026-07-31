import type { Edge, Node } from "@xyflow/react";

import type { TaskSpec } from "@/utils/componentSpec";
import {
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";

import type {
  DiffStatus,
  IoDiff,
  PipelineComparison,
  TaskDiff,
} from "./comparePipelines";

export type SpotlightMode = "both" | "a" | "b";

export interface MergedTaskNodeData extends Record<string, unknown> {
  diff: TaskDiff;
  spotlight: SpotlightMode;
}

export interface MergedIoNodeData extends Record<string, unknown> {
  diff: IoDiff;
  spotlight: SpotlightMode;
}

type MergedTaskNode = Node<MergedTaskNodeData, "mergedTask">;
type MergedIoNode = Node<MergedIoNodeData, "mergedIo">;
export type MergedNode = MergedTaskNode | MergedIoNode;

interface MergedEdgeData extends Record<string, unknown> {
  membership: DiffStatus;
}

type MergedEdge = Edge<MergedEdgeData>;

export interface MergedGraphModel {
  nodes: MergedNode[];
  edges: MergedEdge[];
}

const inputNodeId = (name: string) => `input:${name}`;
const outputNodeId = (name: string) => `output:${name}`;

interface EdgeSides {
  source: string;
  target: string;
  inA: boolean;
  inB: boolean;
}

export function buildMergedGraph(
  comparison: PipelineComparison,
): MergedGraphModel {
  const { taskDiffs, inputDiffs, outputDiffs } = comparison;

  const taskIds = new Set(taskDiffs.map((diff) => diff.taskId));
  const inputIds = new Set(inputDiffs.map((diff) => inputNodeId(diff.name)));
  const outputIds = new Set(outputDiffs.map((diff) => outputNodeId(diff.name)));

  const inputNodes: MergedNode[] = inputDiffs.map((diff) => ({
    id: inputNodeId(diff.name),
    type: "mergedIo",
    position: { x: 0, y: 0 },
    data: { diff, spotlight: "both" },
  }));

  const taskNodes: MergedNode[] = taskDiffs.map((diff) => ({
    id: diff.taskId,
    type: "mergedTask",
    position: { x: 0, y: 0 },
    data: { diff, spotlight: "both" },
  }));

  const outputNodes: MergedNode[] = outputDiffs.map((diff) => ({
    id: outputNodeId(diff.name),
    type: "mergedIo",
    position: { x: 0, y: 0 },
    data: { diff, spotlight: "both" },
  }));

  const edgeSides = new Map<string, EdgeSides>();

  const addEdge = (source: string, target: string, side: "a" | "b") => {
    const key = `${source}->${target}`;
    const existing = edgeSides.get(key) ?? {
      source,
      target,
      inA: false,
      inB: false,
    };
    if (side === "a") existing.inA = true;
    else existing.inB = true;
    edgeSides.set(key, existing);
  };

  const collectTaskInputs = (
    targetId: string,
    taskSpec: TaskSpec | undefined,
    side: "a" | "b",
  ) => {
    if (!taskSpec?.arguments) return;

    for (const argument of Object.values(taskSpec.arguments)) {
      if (isTaskOutputArgument(argument)) {
        const source = argument.taskOutput.taskId;
        if (taskIds.has(source)) addEdge(source, targetId, side);
      } else if (isGraphInputArgument(argument)) {
        const source = inputNodeId(argument.graphInput.inputName);
        if (inputIds.has(source)) addEdge(source, targetId, side);
      }
    }
  };

  for (const diff of taskDiffs) {
    collectTaskInputs(diff.taskId, diff.a, "a");
    collectTaskInputs(diff.taskId, diff.b, "b");
  }

  for (const diff of outputDiffs) {
    const target = outputNodeId(diff.name);
    if (diff.sourceTaskIdA && taskIds.has(diff.sourceTaskIdA)) {
      addEdge(diff.sourceTaskIdA, target, "a");
    }
    if (diff.sourceTaskIdB && taskIds.has(diff.sourceTaskIdB)) {
      addEdge(diff.sourceTaskIdB, target, "b");
    }
  }

  const knownIds = new Set([...taskIds, ...inputIds, ...outputIds]);

  const edges: MergedEdge[] = Array.from(edgeSides.values())
    .filter(
      ({ source, target }) => knownIds.has(source) && knownIds.has(target),
    )
    .map(({ source, target, inA, inB }) => {
      const membership: DiffStatus =
        inA && inB ? "unchanged" : inA ? "lost" : "new";
      return {
        id: `${source}->${target}`,
        source,
        target,
        data: { membership },
      };
    });

  return { nodes: [...inputNodes, ...taskNodes, ...outputNodes], edges };
}
