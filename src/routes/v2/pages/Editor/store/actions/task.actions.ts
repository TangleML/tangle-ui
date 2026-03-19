import type { Node, XYPosition } from "@xyflow/react";

import {
  type ComponentReference,
  type ComponentSpec,
  createTaskFromComponentRef,
  type Task,
} from "@/models/componentSpec";
import type { ClipboardStore } from "@/routes/v2/pages/Editor/store/clipboardStore";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

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

export function deleteSelectedNodes(
  undo: UndoGroupable,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
) {
  if (selectedNodes.length === 0) return;

  undo.withGroup("Delete selected nodes", () => {
    for (const node of selectedNodes) {
      const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
      manifest?.deleteNode(undo, spec, node.id);
    }
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
      const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
      manifest?.updatePosition(undo, spec, node.id, node.position);
    }
  });
}
