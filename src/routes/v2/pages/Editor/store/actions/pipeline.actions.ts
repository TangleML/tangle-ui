import type { XYPosition } from "@xyflow/react";

import {
  type ComponentSpec,
  createSubgraph as modelCreateSubgraph,
  type Task,
} from "@/models/componentSpec";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

import { idGen } from "./utils";

export function renamePipeline(
  undo: UndoGroupable,
  spec: ComponentSpec,
  newName: string,
): boolean {
  return undo.withGroup("Rename pipeline", () => {
    spec.setName(newName);
    return true;
  });
}

export function updatePipelineDescription(
  undo: UndoGroupable,
  spec: ComponentSpec,
  description: string | undefined,
): boolean {
  return undo.withGroup("Update pipeline description", () => {
    spec.setDescription(description);
    return true;
  });
}

export function createSubgraph(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskIds: string[],
  subgraphName: string,
  position: XYPosition,
): Task | null {
  if (taskIds.length === 0) return null;

  const uniqueName = generateUniqueTaskName(spec, subgraphName);

  try {
    const result = undo.withGroup(`Create subgraph "${uniqueName}"`, () => {
      const result = modelCreateSubgraph({
        spec,
        selectedTaskIds: taskIds,
        subgraphName: uniqueName,
        idGen,
      });

      if (!result) return null;

      result.replacementTask.annotations.set("editor.position", position);
      return result;
    });

    if (!result) return null;

    return result.replacementTask;
  } catch (error) {
    console.error("Failed to create subgraph:", error);
    return null;
  }
}
