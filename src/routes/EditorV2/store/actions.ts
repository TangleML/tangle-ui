import "../nodes"; // ensure manifests are registered

import type { XYPosition } from "@xyflow/react";

import {
  type ComponentReference,
  type ComponentSpec,
  createSubgraph as modelCreateSubgraph,
  createTaskFromComponentRef,
  IncrementingIdGenerator,
  Input,
  Output,
  type Task,
  type TypeSpecType,
} from "@/models/componentSpec";

import { NODE_TYPE_REGISTRY } from "../nodes/registry";
import { clipboardStore } from "./clipboardStore";
import type { SelectedNode } from "./editorStore";
import {
  generateUniqueInputName,
  generateUniqueOutputName,
  generateUniqueTaskName,
} from "./nameUtils";
import { withUndoGroup, withUndoGroupReturn } from "./undoStore";

const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";
const idGen = new IncrementingIdGenerator();

export function addTask(
  spec: ComponentSpec,
  componentRef: ComponentReference,
  position: XYPosition,
): Task {
  const componentName = componentRef.spec?.name ?? componentRef.name ?? "Task";
  const taskName = generateUniqueTaskName(spec, componentName);
  const task = createTaskFromComponentRef(idGen, componentRef, taskName);

  task.annotations.set("editor.position", {
    x: position.x,
    y: position.y,
  });

  spec.addTask(task);
  return task;
}

export function addInput(
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Input {
  const inputName = generateUniqueInputName(spec, name);
  const input = new Input({
    $id: idGen.next("input"),
    name: inputName,
  });
  input.annotations.set("editor.position", {
    x: position.x,
    y: position.y,
  });
  spec.addInput(input);
  return input;
}

export function addOutput(
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Output {
  const outputName = generateUniqueOutputName(spec, name);
  const output = new Output({
    $id: idGen.next("output"),
    name: outputName,
  });
  output.annotations.set("editor.position", {
    x: position.x,
    y: position.y,
  });
  spec.addOutput(output);
  return output;
}

interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

export function getNodeTypeFromId(
  nodeId: string,
): "input" | "output" | "task" | "conduit" | null {
  return (
    (NODE_TYPE_REGISTRY.getByNodeId(nodeId)?.entityType as
      | "input"
      | "output"
      | "task"
      | "conduit") ?? null
  );
}

/**
 * Find an entity by its id using the node type registry.
 */
export function findEntityById(
  spec: ComponentSpec,
  entityId: string,
): Task | Input | Output | undefined {
  const manifest = NODE_TYPE_REGISTRY.getByNodeId(entityId);
  return manifest?.findEntity?.(spec, entityId) as
    | Task
    | Input
    | Output
    | undefined;
}

export function connectNodes(
  spec: ComponentSpec,
  connection: ConnectionInfo,
): boolean {
  const { sourceNodeId, sourceHandleId, targetNodeId, targetHandleId } =
    connection;

  const sourceOutputName = sourceHandleId.replace(/^output_/, "");
  const targetInputName = targetHandleId.replace(/^input_/, "");

  const sourceType = getNodeTypeFromId(sourceNodeId);
  const targetType = getNodeTypeFromId(targetNodeId);

  if (sourceType === "input" && targetType === "output") return false;

  spec.connectNodes(
    { entityId: sourceNodeId, portName: sourceOutputName },
    { entityId: targetNodeId, portName: targetInputName },
  );

  return true;
}

export function deleteTask(spec: ComponentSpec, entityId: string): boolean {
  return spec.deleteTaskById(entityId);
}

export function deleteInput(spec: ComponentSpec, entityId: string): boolean {
  return spec.deleteInputById(entityId);
}

export function deleteOutput(spec: ComponentSpec, entityId: string): boolean {
  return spec.deleteOutputById(entityId);
}

export function deleteEdge(spec: ComponentSpec, edgeId: string): boolean {
  const match = edgeId.match(/^edge_(.+)$/);
  if (!match) return false;
  return spec.deleteEdgeById(match[1]);
}

export function renameTask(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return spec.renameTask(entityId, newName);
}

export function renameInput(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return spec.renameInput(entityId, newName);
}

export function renameOutput(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return spec.renameOutput(entityId, newName);
}

export function renamePipeline(spec: ComponentSpec, newName: string): boolean {
  spec.setName(newName);
  return true;
}

export function updatePipelineDescription(
  spec: ComponentSpec,
  description: string | undefined,
): boolean {
  spec.setDescription(description);
  return true;
}

export function updateNodePosition(
  spec: ComponentSpec,
  entityId: string,
  position: XYPosition,
) {
  spec.updateNodePosition(entityId, position);
}

export function createConnectedIONode(
  spec: ComponentSpec,
  taskEntityId: string,
  handleId: string,
  position: XYPosition,
  ioType: "input" | "output",
): void {
  const portName =
    ioType === "input"
      ? handleId.replace(/^input_/, "")
      : handleId.replace(/^output_/, "");

  const task = spec.tasks.find((t) => t.$id === taskEntityId);
  if (!task) return;

  const taskComponentSpec = task.componentRef.spec;

  withUndoGroup("Create connected IO node", () => {
    if (ioType === "input") {
      const inputSpec = taskComponentSpec?.inputs?.find(
        (i) => i.name === portName,
      );
      const newInput = addInput(spec, position, portName);

      if (inputSpec?.type) {
        newInput.setType(inputSpec.type);
      }

      spec.connectNodes(
        { entityId: newInput.$id, portName: newInput.$id },
        { entityId: taskEntityId, portName },
      );
    } else {
      const outputSpec = taskComponentSpec?.outputs?.find(
        (o) => o.name === portName,
      );
      const newOutput = addOutput(spec, position, portName);

      if (outputSpec?.type) {
        newOutput.setType(outputSpec.type);
      }

      spec.connectNodes(
        { entityId: taskEntityId, portName },
        { entityId: newOutput.$id, portName: newOutput.$id },
      );
    }
  });
}

export function createInputAndConnect(
  spec: ComponentSpec,
  targetTaskIds: string[],
  portName: string,
  portType?: TypeSpecType,
): void {
  if (targetTaskIds.length === 0) return;

  const firstTask = spec.tasks.find((t) => targetTaskIds.includes(t.$id));
  const taskPos = firstTask?.annotations.get("editor.position") ?? {
    x: 0,
    y: 0,
  };
  const position = { x: taskPos.x - 250, y: taskPos.y };

  withUndoGroup("Create input and connect", () => {
    const newInput = addInput(spec, position, portName);
    if (portType) {
      newInput.setType(portType);
    }
    for (const taskId of targetTaskIds) {
      spec.connectNodes(
        { entityId: newInput.$id, portName: newInput.$id },
        { entityId: taskId, portName },
      );
    }
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
    const result = withUndoGroupReturn(
      `Create subgraph "${uniqueName}"`,
      () => {
        const result = modelCreateSubgraph({
          spec,
          selectedTaskIds: taskIds,
          subgraphName: uniqueName,
          idGen,
        });

        if (!result) return null;

        result.replacementTask.annotations.set("editor.position", position);
        return result;
      },
    );

    if (!result) return null;

    return result.replacementTask;
  } catch (error) {
    console.error("Failed to create subgraph:", error);
    return null;
  }
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
      const manifest = NODE_TYPE_REGISTRY.getByNodeId(node.id);
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
