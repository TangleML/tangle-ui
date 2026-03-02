import type { XYPosition } from "@xyflow/react";

import type { Annotation } from "@/models/componentSpec";
import {
  Binding,
  type ComponentReference,
  type ComponentSpec,
  createSubgraph as modelCreateSubgraph,
  createTaskFromComponentRef,
  IncrementingIdGenerator,
  indexManager,
  Input,
  Output,
  type Task,
} from "@/models/componentSpec";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

/** ID generator for creating new entities */
const idGen = new IncrementingIdGenerator();

/**
 * Update the position of an entity (task, input, or output) by its $id.
 */
export function updateNodePosition(
  spec: ComponentSpec,
  entityId: string,
  position: XYPosition,
) {
  // Helper to update position annotation
  const updatePositionAnnotation = (annotations: {
    find: (
      predicate: (item: Annotation, index: number) => boolean,
    ) => Annotation | undefined;
    findIndex: (
      predicate: (item: Annotation, index: number) => boolean,
    ) => number;
    update: (index: number, updates: Partial<Annotation>) => void;
    add: (item: Annotation) => void;
  }) => {
    const existingIdx = annotations.findIndex(
      (a: Annotation) => a.key === EDITOR_POSITION_ANNOTATION,
    );
    if (existingIdx >= 0) {
      annotations.update(existingIdx, {
        key: EDITOR_POSITION_ANNOTATION,
        value: JSON.stringify(position),
      });
    } else {
      annotations.add({
        key: EDITOR_POSITION_ANNOTATION,
        value: JSON.stringify(position),
      });
    }
  };

  // Find entity by ID using IndexManager
  const task = indexManager.findOne("task", "$id", entityId) as
    | Task
    | undefined;
  if (task) {
    updatePositionAnnotation(task.annotations);
    return;
  }

  const input = indexManager.findOne("input", "$id", entityId) as
    | Input
    | undefined;
  if (input) {
    updatePositionAnnotation(input.annotations);
    return;
  }

  const output = indexManager.findOne("output", "$id", entityId) as
    | Output
    | undefined;
  if (output) {
    updatePositionAnnotation(output.annotations);
  }
}

/**
 * Generate a unique task name based on the component name.
 */
function generateUniqueTaskName(spec: ComponentSpec, baseName: string): string {
  const existingNames = new Set(spec.tasks.all.map((t) => t.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

/**
 * Generate a unique input name.
 */
function generateUniqueInputName(
  spec: ComponentSpec,
  baseName: string = "Input",
): string {
  const existingNames = new Set(spec.inputs.all.map((i) => i.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

/**
 * Generate a unique output name.
 */
function generateUniqueOutputName(
  spec: ComponentSpec,
  baseName: string = "Output",
): string {
  const existingNames = new Set(spec.outputs.all.map((o) => o.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

/**
 * Add a new task to the graph.
 */
export function addTask(
  spec: ComponentSpec,
  componentRef: ComponentReference,
  position: XYPosition,
): Task {
  const componentName = componentRef.spec?.name ?? componentRef.name ?? "Task";
  const taskName = generateUniqueTaskName(spec, componentName);

  const task = createTaskFromComponentRef(idGen, componentRef, taskName);

  // Add position annotation
  task.annotations.add({
    key: EDITOR_POSITION_ANNOTATION,
    value: JSON.stringify({ x: position.x, y: position.y }),
  });

  spec.tasks.add(task);

  return task;
}

/**
 * Add a new input node to the graph.
 */
export function addInput(
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Input {
  const inputName = generateUniqueInputName(spec, name);

  const input = new Input(idGen.next("input"), { name: inputName });

  // Add position annotation
  input.annotations.add({
    key: EDITOR_POSITION_ANNOTATION,
    value: JSON.stringify({ x: position.x, y: position.y }),
  });

  spec.inputs.add(input);

  return input;
}

/**
 * Add a new output node to the graph.
 */
export function addOutput(
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Output {
  const outputName = generateUniqueOutputName(spec, name);

  const output = new Output(idGen.next("output"), { name: outputName });

  // Add position annotation
  output.annotations.add({
    key: EDITOR_POSITION_ANNOTATION,
    value: JSON.stringify({ x: position.x, y: position.y }),
  });

  spec.outputs.add(output);

  return output;
}

/**
 * Connection info parsed from ReactFlow handles.
 */
export interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

/**
 * Helper to determine node type from entity $id.
 * Entity IDs follow patterns like "task_1", "input_2", "output_3"
 */
export function getNodeTypeFromId(
  nodeId: string,
): "input" | "output" | "task" | null {
  if (nodeId.startsWith("input_")) return "input";
  if (nodeId.startsWith("output_")) return "output";
  if (nodeId.startsWith("task_")) return "task";
  return null;
}

/**
 * Connect two nodes by creating a binding.
 */
export function connectNodes(
  spec: ComponentSpec,
  connection: ConnectionInfo,
): boolean {
  const { sourceNodeId, sourceHandleId, targetNodeId, targetHandleId } =
    connection;

  // Parse handle IDs to get the actual names
  // Handle format: "input_{inputName}" or "output_{outputName}"
  const sourceOutputName = sourceHandleId.replace(/^output_/, "");
  const targetInputName = targetHandleId.replace(/^input_/, "");

  // Determine node types
  const sourceType = getNodeTypeFromId(sourceNodeId);
  const targetType = getNodeTypeFromId(targetNodeId);

  const isSourceGraphInput = sourceType === "input";
  const isTargetGraphOutput = targetType === "output";

  if (isSourceGraphInput && isTargetGraphOutput) {
    console.error("Cannot connect graph input directly to graph output");
    return false;
  }

  // Remove any existing binding to the same target port
  spec.bindings.removeBy(
    (b) =>
      b.targetEntityId === targetNodeId && b.targetPortName === targetInputName,
  );

  // Create the new binding
  const binding = new Binding(idGen.next("binding"), {
    source: { entityId: sourceNodeId, portName: sourceOutputName },
    target: { entityId: targetNodeId, portName: targetInputName },
  });

  spec.bindings.add(binding);

  // If target is a task, ensure the argument exists
  if (targetType === "task") {
    const task = spec.tasks.find((t) => t.$id === targetNodeId);
    if (task) {
      const existingArg = task.arguments.find(
        (a) => a.name === targetInputName,
      );
      if (!existingArg) {
        task.arguments.add({ name: targetInputName });
      }
    }
  }

  return true;
}

/**
 * Delete a task by its entity $id.
 */
export function deleteTask(spec: ComponentSpec, entityId: string): boolean {
  const taskIndex = spec.tasks.findIndex((t) => t.$id === entityId);
  if (taskIndex < 0) {
    console.error(`Task not found: ${entityId}`);
    return false;
  }

  // Remove all bindings that reference this task
  spec.bindings.removeBy(
    (b) => b.sourceEntityId === entityId || b.targetEntityId === entityId,
  );

  // Remove the task
  spec.tasks.remove(taskIndex);

  return true;
}

/**
 * Delete an input by its entity $id.
 */
export function deleteInput(spec: ComponentSpec, entityId: string): boolean {
  const inputIndex = spec.inputs.findIndex((i) => i.$id === entityId);
  if (inputIndex < 0) {
    console.error(`Input not found: ${entityId}`);
    return false;
  }

  // Remove all bindings that reference this input
  spec.bindings.removeBy((b) => b.sourceEntityId === entityId);

  // Remove the input
  spec.inputs.remove(inputIndex);

  return true;
}

/**
 * Delete an output by its entity $id.
 */
export function deleteOutput(spec: ComponentSpec, entityId: string): boolean {
  const outputIndex = spec.outputs.findIndex((o) => o.$id === entityId);
  if (outputIndex < 0) {
    console.error(`Output not found: ${entityId}`);
    return false;
  }

  // Remove all bindings that reference this output
  spec.bindings.removeBy((b) => b.targetEntityId === entityId);

  // Remove the output
  spec.outputs.remove(outputIndex);

  return true;
}

/**
 * Delete an edge by its binding $id.
 *
 * Edge format: `edge_{binding.$id}`
 */
export function deleteEdge(spec: ComponentSpec, edgeId: string): boolean {
  // Extract binding ID from edge ID format: edge_{binding.$id}
  const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
  if (!bindingIdMatch) {
    console.error(`Invalid edge ID format: ${edgeId}`);
    return false;
  }

  const bindingId = bindingIdMatch[1];
  const bindingIndex = spec.bindings.findIndex((b) => b.$id === bindingId);

  if (bindingIndex < 0) {
    console.error(`Binding not found: ${bindingId}`);
    return false;
  }

  spec.bindings.remove(bindingIndex);

  return true;
}

/**
 * Rename a task by its entity $id.
 */
export function renameTask(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  const task = spec.tasks.find((t) => t.$id === entityId);
  if (!task) {
    console.error(`Task not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingTask = spec.tasks.find(
    (t) => t.name === newName && t.$id !== entityId,
  );
  if (existingTask) {
    console.error(`Task name already exists: ${newName}`);
    return false;
  }

  task.name = newName;

  return true;
}

/**
 * Rename an input by its entity $id.
 */
export function renameInput(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  const input = spec.inputs.find((i) => i.$id === entityId);
  if (!input) {
    console.error(`Input not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingInput = spec.inputs.find(
    (i) => i.name === newName && i.$id !== entityId,
  );
  if (existingInput) {
    console.error(`Input name already exists: ${newName}`);
    return false;
  }

  input.name = newName;

  return true;
}

/**
 * Rename the spec (pipeline or subgraph).
 */
export function renamePipeline(spec: ComponentSpec, newName: string): boolean {
  spec.name = newName;
  return true;
}

/**
 * Update the spec description.
 */
export function updatePipelineDescription(
  spec: ComponentSpec,
  description: string | undefined,
): boolean {
  spec.description = description;
  return true;
}

/**
 * Rename an output by its entity $id.
 */
export function renameOutput(
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  const output = spec.outputs.find((o) => o.$id === entityId);
  if (!output) {
    console.error(`Output not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingOutput = spec.outputs.find(
    (o) => o.name === newName && o.$id !== entityId,
  );
  if (existingOutput) {
    console.error(`Output name already exists: ${newName}`);
    return false;
  }

  output.name = newName;

  return true;
}

/**
 * Create a subgraph from selected task IDs.
 */
export function createSubgraph(
  spec: ComponentSpec,
  taskIds: string[],
  subgraphName: string,
  position: XYPosition,
): Task | null {
  if (taskIds.length === 0) {
    console.error("Cannot create subgraph: no tasks selected");
    return null;
  }

  const uniqueSubgraphName = generateUniqueTaskName(spec, subgraphName);

  try {
    const result = modelCreateSubgraph({
      spec,
      selectedTaskIds: taskIds,
      subgraphName: uniqueSubgraphName,
      idGen,
    });

    if (!result) {
      console.error("Failed to create subgraph: no result returned");
      return null;
    }

    // Add position annotation to the replacement task
    result.replacementTask.annotations.add({
      key: EDITOR_POSITION_ANNOTATION,
      value: JSON.stringify(position),
    });

    return result.replacementTask;
  } catch (error) {
    console.error("Failed to create subgraph:", error);
    return null;
  }
}
