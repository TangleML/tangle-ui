import type { Node } from "@xyflow/react";

import type { NodeSize } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import {
  condensePorts,
  resolveConnectedPortNames,
} from "@/routes/v2/shared/nodes/TaskNode/ports.utils";
import { AGGREGATOR_INTERNAL_INPUTS } from "@/utils/aggregatorInputs";
import {
  EDITOR_COLLAPSED_ANNOTATION,
  isPipelineAggregator,
} from "@/utils/annotations";
import {
  isConditionalExecutionSupported,
  isTaskConditional,
} from "@/utils/conditionalExecution";

const ESTIMATE_SAFETY_MARGIN = 16;

const TASK_CARD_WIDTH = 350;
const TASK_CARD_FRAME_HEIGHT = 40;
const TASK_TITLE_LINE_HEIGHT = 16;
const TASK_TITLE_CHARS_PER_LINE = 30;
const TASK_SECTION_GAP = 8;
const TASK_SECTION_PADDING = 16;
const TASK_ROW_HEIGHT = 24;
const TASK_ROW_GAP = 12;
const TASK_RUN_CONDITION_HEIGHT = 40;
const TASK_STATUS_BAR_HEIGHT = 8;
const TASK_OUTPUT_TYPE_SELECTOR_HEIGHT = 36;

const IO_CARD_WIDTH = 240;
const IO_CARD_FRAME_HEIGHT = 136;
const IO_TITLE_LINE_HEIGHT = 20;
const IO_TITLE_CHARS_PER_LINE = 22;
const IO_DESCRIPTION_HEIGHT = 22;

const lineCount = (text: string, charsPerLine: number) =>
  Math.max(1, Math.ceil(text.length / charsPerLine));

const visibleRowCount = (
  ports: { name: string }[],
  connectedNames: ReadonlySet<string>,
  collapsed: boolean,
) => (collapsed ? condensePorts(ports, connectedNames) : ports).length;

const stackedHeight = (heights: number[], gap: number) =>
  heights.length === 0
    ? 0
    : heights.reduce((sum, height) => sum + height, 0) +
      gap * (heights.length - 1);

const rowSectionHeight = (rowHeights: number[]) =>
  TASK_SECTION_PADDING + stackedHeight(rowHeights, TASK_ROW_GAP);

export function estimateTaskCardSize(
  task: Task,
  spec: ComponentSpec,
): NodeSize {
  const componentSpec = task.resolvedComponentSpec;
  const isAggregator = isPipelineAggregator(
    componentSpec?.metadata?.annotations,
  );
  const collapsed =
    task.annotations.get(EDITOR_COLLAPSED_ANNOTATION) === "true";
  const inputs = (componentSpec?.inputs ?? []).filter(
    (input) => !isAggregator || !AGGREGATOR_INTERNAL_INPUTS.has(input.name),
  );
  const outputs = componentSpec?.outputs ?? [];
  const connected = resolveConnectedPortNames(task.$id, spec);

  const sections: number[] = [];
  if (task.isSubgraph) sections.push(TASK_STATUS_BAR_HEIGHT);
  if (isConditionalExecutionSupported(task) && isTaskConditional(task, spec)) {
    sections.push(TASK_RUN_CONDITION_HEIGHT);
  }

  const inputRowCount = visibleRowCount(
    inputs,
    connected.inputs,
    collapsed && !isAggregator,
  );
  const inputRows: number[] = Array(inputRowCount).fill(TASK_ROW_HEIGHT);
  if (isAggregator) inputRows.unshift(TASK_ROW_HEIGHT);
  if (inputRows.length > 0) sections.push(rowSectionHeight(inputRows));

  const outputRowCount = visibleRowCount(outputs, connected.outputs, collapsed);
  const outputRows: number[] = Array(outputRowCount).fill(TASK_ROW_HEIGHT);
  if (isAggregator) outputRows.unshift(TASK_OUTPUT_TYPE_SELECTOR_HEIGHT);
  if (outputRows.length > 0) sections.push(rowSectionHeight(outputRows));

  return {
    width: TASK_CARD_WIDTH,
    height:
      TASK_CARD_FRAME_HEIGHT +
      TASK_TITLE_LINE_HEIGHT * lineCount(task.name, TASK_TITLE_CHARS_PER_LINE) +
      stackedHeight(sections, TASK_SECTION_GAP) +
      ESTIMATE_SAFETY_MARGIN,
  };
}

export function estimateIONodeCardSize({
  name,
  description,
}: {
  name: string;
  description?: string;
}): NodeSize {
  return {
    width: IO_CARD_WIDTH,
    height:
      IO_CARD_FRAME_HEIGHT +
      IO_TITLE_LINE_HEIGHT * lineCount(name, IO_TITLE_CHARS_PER_LINE) +
      (description ? IO_DESCRIPTION_HEIGHT : 0) +
      ESTIMATE_SAFETY_MARGIN,
  };
}

export function estimateFullCardSize(
  node: Node,
  spec: ComponentSpec,
): NodeSize | undefined {
  switch (node.type) {
    case "task": {
      const task = spec.tasks.find((t) => t.$id === node.id);
      return task ? estimateTaskCardSize(task, spec) : undefined;
    }
    case "input": {
      const input = spec.inputs.find((i) => i.$id === node.id);
      return input ? estimateIONodeCardSize(input) : undefined;
    }
    case "output": {
      const output = spec.outputs.find((o) => o.$id === node.id);
      return output ? estimateIONodeCardSize(output) : undefined;
    }
    default:
      return undefined;
  }
}
