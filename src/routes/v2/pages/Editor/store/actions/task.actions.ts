import type { Node, XYPosition } from "@xyflow/react";

import {
  type ComponentReference,
  type ComponentSpec,
  createTaskFromComponentRef,
  type Task,
} from "@/models/componentSpec";
import { clipboardStore } from "@/routes/v2/pages/Editor/store/clipboardStore";
import { generateUniqueTaskName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { idGen, TASK_COLOR_ANNOTATION } from "./utils";

export function addTask(
  spec: ComponentSpec,
  componentRef: ComponentReference,
  position: XYPosition,
): Task {
  return withUndoGroup("Add task", () => {
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

export function deleteTask(spec: ComponentSpec, entityId: string): boolean {
  return withUndoGroup("Delete task", () => spec.deleteTaskById(entityId));
}

export function renameTask(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return withUndoGroup("Rename task", () => spec.renameTask(entityId, newName));
}

export function duplicateSelectedNodes(
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
): string[] {
  if (selectedNodes.length === 0) return [];
  return clipboardStore.duplicate(spec, selectedNodes);
}

export function copySelectedNodes(
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
) {
  clipboardStore.copy(spec, selectedNodes);
}

export async function pasteNodes(
  spec: ComponentSpec,
  position: XYPosition,
): Promise<string[]> {
  return clipboardStore.paste(spec, position);
}

export function deleteSelectedNodes(
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
) {
  if (selectedNodes.length === 0) return;

  withUndoGroup("Delete selected nodes", () => {
    for (const node of selectedNodes) {
      const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
      manifest?.deleteNode(spec, node.id);
    }
  });
}

export function batchSetTaskColor(tasks: Task[], color: string) {
  withUndoGroup("Batch task color update", () => {
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
  spec: ComponentSpec,
  layoutedNodes: Node[],
) {
  withUndoGroup("Auto layout", () => {
    for (const node of layoutedNodes) {
      const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
      manifest?.updatePosition(spec, node.id, node.position);
    }
  });
}
