import type { XYPosition } from "@xyflow/react";

import {
  type ComponentSpec,
  createSubgraph as modelCreateSubgraph,
  type Task,
} from "@/models/componentSpec";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";

import { idGen } from "./utils";

export function renamePipeline(spec: ComponentSpec, newName: string): boolean {
  return withUndoGroup("Rename pipeline", () => {
    spec.setName(newName);
    return true;
  });
}

export function updatePipelineDescription(
  spec: ComponentSpec,
  description: string | undefined,
): boolean {
  return withUndoGroup("Update pipeline description", () => {
    spec.setDescription(description);
    return true;
  });
}

export function createSubgraph(
  spec: ComponentSpec,
  taskIds: string[],
  subgraphName: string,
  position: XYPosition,
): Task | null {
  if (taskIds.length === 0) return null;

  const uniqueName = generateUniqueTaskName(spec, subgraphName);

  try {
    const result = withUndoGroup(`Create subgraph "${uniqueName}"`, () => {
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
