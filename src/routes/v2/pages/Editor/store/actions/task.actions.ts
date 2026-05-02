import type { Node, XYPosition } from "@xyflow/react";

import {
  type ComponentReference,
  type ComponentSpec,
  createTaskFromComponentRef,
  type Task,
  unpackSubgraph,
} from "@/models/componentSpec";
import type { UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import { editorRegistry } from "@/routes/v2/pages/Editor/nodes";
import type { ClipboardStore } from "@/routes/v2/pages/Editor/store/clipboardStore";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";
import type { ParentContext } from "@/routes/v2/shared/store/navigationStore";

import { computeDiffComponentSpecs } from "./task.utils";
import { idGen, TASK_COLOR_ANNOTATION } from "./utils";

export function addTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  componentRef: ComponentReference,
  position: XYPosition,
): Task {
  return undo.withGroup("Add task", () => {
    const componentName =
      componentRef.spec?.name ?? componentRef.name ?? "Task";
    const taskName = generateUniqueTaskName(spec, componentName);
    const task = createTaskFromComponentRef(idGen, componentRef, taskName);

    task.annotations.set("editor.position", {
      x: position.x,
      y: position.y,
    });

    spec.addTask(task);
    return task;
  });
}

export function deleteTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
): boolean {
  if (!spec.tasks.some((t) => t.$id === entityId)) return false;
  return undo.withGroup("Delete task", () => spec.deleteTaskById(entityId));
}

export function renameTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return undo.withGroup("Rename task", () =>
    spec.renameTask(entityId, newName),
  );
}

export function duplicateSelectedNodes(
  clipboard: ClipboardStore,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
): string[] {
  if (selectedNodes.length === 0) return [];
  return clipboard.duplicate(spec, selectedNodes);
}

export function copySelectedNodes(
  clipboard: ClipboardStore,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
) {
  clipboard.copy(spec, selectedNodes);
}

export async function pasteNodes(
  clipboard: ClipboardStore,
  spec: ComponentSpec,
  position: XYPosition,
): Promise<string[]> {
  return clipboard.paste(spec, position);
}

/**
 * Deletes nodes via manifests. Caller must wrap in `undo.withGroup` when
 * batching with other operations (e.g. edge deletes in one shortcut).
 */
export function deleteSelectedNodesCore(
  undo: UndoGroupable,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
  parentContext?: ParentContext | null,
): void {
  for (const node of selectedNodes) {
    const manifest = editorRegistry.getByNodeId(spec, node.id);
    manifest?.deleteNode(undo, spec, node.id, parentContext);
  }
}

export function deleteSelectedNodes(
  undo: UndoGroupable,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
  parentContext?: ParentContext | null,
) {
  if (selectedNodes.length === 0) return;

  undo.withGroup("Delete selected nodes", () => {
    deleteSelectedNodesCore(undo, spec, selectedNodes, parentContext);
  });
}

export function batchSetTaskColor(
  undo: UndoGroupable,
  tasks: Task[],
  color: string,
) {
  undo.withGroup("Batch task color update", () => {
    for (const task of tasks) {
      if (color === "transparent") {
        task.annotations.remove(TASK_COLOR_ANNOTATION);
      } else {
        task.annotations.set(TASK_COLOR_ANNOTATION, color);
      }
    }
  });
}

export function applyAutoLayoutPositions(
  undo: UndoGroupable,
  spec: ComponentSpec,
  layoutedNodes: Node[],
) {
  undo.withGroup("Auto layout", () => {
    for (const node of layoutedNodes) {
      const manifest = editorRegistry.getByNodeId(spec, node.id);
      manifest?.updatePosition(undo, spec, node.id, node.position);
    }
  });
}

/**
 * Replace a task's componentRef with a new one, cleaning up arguments and
 * bindings for inputs/outputs that no longer exist in the new version.
 */
export function replaceTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskId: string,
  newComponentRef: ComponentReference,
) {
  return undo.withGroup("Upgrade task", () => {
    const task = spec.tasks.find((t) => t.$id === taskId);
    if (!task) return { lostInputs: [] };

    const { inputDiff, outputDiff } = computeDiffComponentSpecs(
      task.resolvedComponentSpec,
      newComponentRef.spec,
    );

    for (const input of inputDiff.lostEntities) {
      task.removeArgumentByName(input.name);
    }

    for (const newInput of inputDiff.newEntities) {
      task.addArgument({
        name: newInput.name,
        value: newInput.default,
      });
    }

    const lostInputNames = new Set(inputDiff.lostEntities.map((i) => i.name));
    const lostOutputNames = new Set(outputDiff.lostEntities.map((o) => o.name));
    spec.removeAllBindingsBy(
      (b) =>
        (b.targetEntityId === taskId && lostInputNames.has(b.targetPortName)) ||
        (b.sourceEntityId === taskId && lostOutputNames.has(b.sourcePortName)),
    );

    task.setComponentRef(newComponentRef);
    return { inputDiff, outputDiff };
  });
}

export function upgradeSelectedTasks(
  undo: UndoGroupable,
  spec: ComponentSpec,
  candidates: UpgradeCandidate[],
): void {
  undo.withGroup("Upgrade components", () => {
    for (const candidate of candidates) {
      replaceTask(undo, spec, candidate.taskId, candidate.newComponentRef);
    }
  });
}

export function unpackSubgraphTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskId: string,
): boolean {
  try {
    return undo.withGroup("Unpack subgraph", () =>
      unpackSubgraph({ spec, taskId, idGen }),
    );
  } catch (error) {
    console.error("Failed to unpack subgraph:", error);
    return false;
  }
}
