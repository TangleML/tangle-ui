import type { XYPosition } from "@xyflow/react";

import type { Input, Output, Task } from "@/models/componentSpec";
import {
  ioDefaultPosition,
  resolvePosition,
  taskDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";

export function buildEntityPositionMap(
  inputs: Input[],
  outputs: Output[],
  tasks: Task[],
): Map<string, XYPosition> {
  const map = new Map<string, XYPosition>();
  for (const [index, input] of inputs.entries()) {
    const pos = input.annotations.get("editor.position");
    map.set(input.$id, resolvePosition(pos, ioDefaultPosition(index, -200)));
  }
  for (const [index, output] of outputs.entries()) {
    const pos = output.annotations.get("editor.position");
    map.set(output.$id, resolvePosition(pos, ioDefaultPosition(index, 800)));
  }
  for (const [index, task] of tasks.entries()) {
    const pos = task.annotations.get("editor.position");
    map.set(task.$id, resolvePosition(pos, taskDefaultPosition(index)));
  }
  return map;
}
