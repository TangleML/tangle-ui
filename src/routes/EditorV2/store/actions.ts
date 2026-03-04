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
} from "@/models/componentSpec";

const idGen = new IncrementingIdGenerator();

function generateUniqueTaskName(spec: ComponentSpec, baseName: string): string {
  const existingNames = new Set(spec.tasks.map((t) => t.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

function generateUniqueInputName(
  spec: ComponentSpec,
  baseName = "Input",
): string {
  const existingNames = new Set(spec.inputs.map((i) => i.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

function generateUniqueOutputName(
  spec: ComponentSpec,
  baseName = "Output",
): string {
  const existingNames = new Set(spec.outputs.map((o) => o.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

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
): "input" | "output" | "task" | null {
  if (nodeId.startsWith("input_")) return "input";
  if (nodeId.startsWith("output_")) return "output";
  if (nodeId.startsWith("task_")) return "task";
  return null;
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

export function createSubgraph(
  spec: ComponentSpec,
  taskIds: string[],
  subgraphName: string,
  position: XYPosition,
): Task | null {
  if (taskIds.length === 0) return null;

  const uniqueName = generateUniqueTaskName(spec, subgraphName);

  try {
    const result = modelCreateSubgraph({
      spec,
      selectedTaskIds: taskIds,
      subgraphName: uniqueName,
      idGen,
    });

    if (!result) return null;

    result.replacementTask.annotations.set("editor.position", position);

    return result.replacementTask;
  } catch (error) {
    console.error("Failed to create subgraph:", error);
    return null;
  }
}
