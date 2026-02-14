import type { XYPosition } from "@xyflow/react";
import { proxy } from "valtio";

import type { BindingEntity } from "@/providers/ComponentSpec/bindings";
import { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import type { InputEntity } from "@/providers/ComponentSpec/inputs";
import type { OutputEntity } from "@/providers/ComponentSpec/outputs";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";

import { editorStore } from "./editorStore";

/**
 * Check if the spec has a graph implementation.
 */
function hasGraphImplementation(
  spec: ComponentSpecEntity | null,
): spec is ComponentSpecEntity & { implementation: GraphImplementation } {
  return spec?.implementation instanceof GraphImplementation;
}

/**
 * Update the position of an entity (task, input, or output) by its $id.
 */
export function updateNodePosition(entityId: string, position: XYPosition) {
  const { spec } = editorStore;
  if (!spec) return;

  // Try to find as task
  const task = spec.implementation?.tasks?.entities?.[entityId];
  if (task) {
    // Find and remove existing position annotation, then add the new one
    const existing = task.annotations
      .getAll()
      .find((a) => a.key === EDITOR_POSITION_ANNOTATION);
    if (existing) {
      existing.value = JSON.stringify(position);
    } else {
      task.annotations.add({
        key: EDITOR_POSITION_ANNOTATION,
        value: JSON.stringify(position),
      });
    }
    return;
  }

  // Try to find as input
  const input = spec.inputs.entities[entityId];
  if (input) {
    input.annotations.add({
      key: EDITOR_POSITION_ANNOTATION,
      value: JSON.stringify(position),
    });
    return;
  }

  // Try to find as output
  const output = spec.outputs.entities[entityId];
  if (output) {
    output.annotations.add({
      key: EDITOR_POSITION_ANNOTATION,
      value: JSON.stringify(position),
    });
  }
}

/**
 * Generate a unique task name based on the component name.
 */
function generateUniqueTaskName(
  spec: ComponentSpecEntity,
  baseName: string,
): string {
  if (!hasGraphImplementation(spec)) {
    return baseName;
  }

  const existingNames = new Set(
    spec.implementation.tasks.getAll().map((t) => t.name),
  );

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
 * Register a ComponentSpecEntity for a task's component spec.
 *
 * This is necessary so that findComponentSpecEntity(taskName) can find the
 * task's component spec when creating connections between nodes.
 * The YamlLoader does this automatically when loading from YAML, but we need
 * to do it manually when adding tasks via drag-and-drop.
 */
function registerTaskComponentSpec(
  parentSpec: ComponentSpecEntity,
  taskName: string,
  componentSpec: ComponentSpec,
): void {
  // Create a ComponentSpecEntity for this task's component spec
  const taskComponentSpecEntity = proxy(
    new ComponentSpecEntity(parentSpec.generateId(), parentSpec, {
      name: taskName,
    }),
  ).populate({
    name: taskName,
    description: componentSpec.description,
  });

  // Register it so findComponentSpecEntity can find it by task name
  parentSpec.registerEntity(taskComponentSpecEntity);

  // Add inputs to the component spec entity
  for (const input of componentSpec.inputs ?? []) {
    taskComponentSpecEntity.inputs.add({
      name: input.name,
      type: input.type,
      description: input.description,
    });
  }

  // Add outputs to the component spec entity
  for (const output of componentSpec.outputs ?? []) {
    taskComponentSpecEntity.outputs.add({
      name: output.name,
      type: output.type,
      description: output.description,
    });
  }
}

/**
 * Generate a unique input name.
 */
function generateUniqueInputName(
  spec: ComponentSpecEntity,
  baseName: string = "Input",
): string {
  const existingNames = new Set(spec.inputs.getAll().map((i) => i.name));

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
  spec: ComponentSpecEntity,
  baseName: string = "Output",
): string {
  const existingNames = new Set(spec.outputs.getAll().map((o) => o.name));

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
  componentRef: ComponentReference,
  position: XYPosition,
) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot add task: spec has no graph implementation");
    return null;
  }

  const componentName = componentRef.spec?.name ?? componentRef.name ?? "Task";
  const taskName = generateUniqueTaskName(spec, componentName);

  const taskEntity = spec.implementation.tasks.add({
    name: taskName,
    componentRef,
    annotations: {
      [EDITOR_POSITION_ANNOTATION]: JSON.stringify({
        x: position.x,
        y: position.y,
      }),
    },
  });

  // Register the task's component spec so findComponentSpecEntity can find it
  // This is necessary for creating connections between task outputs and inputs
  if (componentRef.spec) {
    registerTaskComponentSpec(spec, taskName, componentRef.spec);
  }

  // Add default argument values from component spec inputs
  const inputs = componentRef.spec?.inputs ?? [];
  for (const input of inputs) {
    if (input.default !== undefined) {
      const arg = taskEntity.arguments.add({ name: input.name });
      arg.value = input.default;
    }
  }

  return taskEntity;
}

/**
 * Add a new input node to the graph.
 */
export function addInput(position: XYPosition, name?: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot add input: no spec loaded");
    return null;
  }

  const inputName = generateUniqueInputName(spec, name);

  const inputEntity = spec.inputs.add({
    name: inputName,
    annotations: {
      [EDITOR_POSITION_ANNOTATION]: JSON.stringify({
        x: position.x,
        y: position.y,
      }),
    },
  });

  return inputEntity;
}

/**
 * Add a new output node to the graph.
 */
export function addOutput(position: XYPosition, name?: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot add output: no spec loaded");
    return null;
  }

  const outputName = generateUniqueOutputName(spec, name);

  const outputEntity = spec.outputs.add({
    name: outputName,
    annotations: {
      [EDITOR_POSITION_ANNOTATION]: JSON.stringify({
        x: position.x,
        y: position.y,
      }),
    },
  });

  return outputEntity;
}

/**
 * Connection info parsed from ReactFlow handles.
 */
interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

/**
 * Helper to determine node type from entity $id.
 * Entity IDs follow the pattern: root.{specName}.{collection}_{number}
 * e.g., "root.MyPipeline.inputs_1", "root.MyPipeline.outputs_2", "root.MyPipeline.tasks_3"
 */
function getNodeTypeFromId(nodeId: string): "input" | "output" | "task" | null {
  if (nodeId.includes(".inputs_")) return "input";
  if (nodeId.includes(".outputs_")) return "output";
  if (nodeId.includes(".tasks_")) return "task";
  return null;
}

// =============================================================================
// UNIFIED BINDING API
// =============================================================================

/**
 * Create a binding between two ports.
 *
 * This is the unified API for creating all types of bindings:
 * - Graph input → Task input
 * - Task output → Task input
 * - Task output → Graph output
 *
 * @param sourceEntityId - The $id of the source entity (input or task)
 * @param sourcePort - The name of the output port on the source
 * @param targetEntityId - The $id of the target entity (task or output)
 * @param targetPort - The name of the input port on the target
 */
export function createBinding(
  sourceEntityId: string,
  sourcePort: string,
  targetEntityId: string,
  targetPort: string,
): boolean {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot create binding: spec has no graph implementation");
    return false;
  }

  spec.implementation.bindings.bind(
    { entityId: sourceEntityId, portName: sourcePort },
    { entityId: targetEntityId, portName: targetPort },
  );

  return true;
}

/**
 * Remove a binding to a specific target port.
 *
 * @param targetEntityId - The $id of the target entity
 * @param targetPort - The name of the input port on the target
 */
export function removeBindingToPort(
  targetEntityId: string,
  targetPort: string,
): boolean {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot remove binding: spec has no graph implementation");
    return false;
  }

  return spec.implementation.bindings.unbindByTargetPort(
    targetEntityId,
    targetPort,
  );
}

/**
 * Remove all bindings associated with an entity.
 *
 * @param entityId - The $id of the entity
 */
export function removeBindingsByEntity(entityId: string): number {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot remove bindings: spec has no graph implementation");
    return 0;
  }

  return spec.implementation.bindings.unbindByEntity(entityId);
}

// =============================================================================
// CONNECTION API
// =============================================================================

/**
 * Connect two nodes by creating a binding.
 *
 * Handles these connection types:
 * - Task output → Task input (taskOutput binding)
 * - Graph input → Task input (graphInput binding)
 * - Task output → Graph output (outputValue binding)
 *
 * Node IDs are entity $ids in the format: root.{specName}.{collection}_{number}
 */
export function connectNodes(connection: ConnectionInfo) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot connect: spec has no graph implementation");
    return false;
  }

  const { sourceNodeId, sourceHandleId, targetNodeId, targetHandleId } =
    connection;

  // Parse handle IDs to get the actual names
  // Handle format: "input_{inputName}" or "output_{outputName}"
  const sourceOutputName = sourceHandleId.replace(/^output_/, "");
  const targetInputName = targetHandleId.replace(/^input_/, "");

  // Determine node types from entity $id format
  const sourceType = getNodeTypeFromId(sourceNodeId);
  const targetType = getNodeTypeFromId(targetNodeId);

  const isSourceGraphInput = sourceType === "input";
  const isTargetGraphOutput = targetType === "output";

  if (isSourceGraphInput && isTargetGraphOutput) {
    // Cannot directly connect graph input to graph output
    console.error("Cannot connect graph input directly to graph output");
    return false;
  }

  if (isTargetGraphOutput) {
    // Task output → Graph output
    const targetOutput = spec.outputs.findById(targetNodeId);
    if (!targetOutput) {
      console.error(`Target output not found: ${targetNodeId}`);
      return false;
    }

    spec.implementation.bindings.bind(
      { entityId: sourceNodeId, portName: sourceOutputName },
      { entityId: targetNodeId, portName: targetOutput.name },
    );

    return true;
  }

  // Target is a task - look up by $id
  const targetTask = spec.implementation.tasks.findById(targetNodeId);

  if (!targetTask) {
    console.error(`Target task not found: ${targetNodeId}`);
    return false;
  }

  // Find or create the argument (for serialization purposes)
  const existingArg = targetTask.arguments.findByIndex("name", targetInputName)[0];
  if (!existingArg) {
    targetTask.arguments.add({ name: targetInputName });
  }

  if (isSourceGraphInput) {
    // Graph input → Task input
    const graphInput = spec.inputs.findById(sourceNodeId);

    if (!graphInput) {
      console.error(`Graph input not found: ${sourceNodeId}`);
      return false;
    }

    spec.implementation.bindings.bind(
      { entityId: sourceNodeId, portName: graphInput.name },
      { entityId: targetNodeId, portName: targetInputName },
    );

    return true;
  }

  // Task output → Task input
  spec.implementation.bindings.bind(
    { entityId: sourceNodeId, portName: sourceOutputName },
    { entityId: targetNodeId, portName: targetInputName },
  );

  return true;
}

/**
 * Remove a connection by resetting the argument to a literal value.
 */
export function removeConnection(taskName: string, argumentName: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot remove connection: spec has no graph implementation");
    return false;
  }

  const task = spec.implementation.tasks.findByIndex("name", taskName)[0];

  if (!task) {
    console.error(`Task not found: ${taskName}`);
    return false;
  }

  const argument = task.arguments.findByIndex("name", argumentName)[0];

  if (!argument) {
    console.error(`Argument not found: ${argumentName}`);
    return false;
  }

  // Reset to empty literal value
  argument.value = "";
  return true;
}

/**
 * Delete a task by its entity $id.
 *
 * Bindings referencing this task are automatically cleaned up via reactive subscriptions.
 */
export function deleteTask(entityId: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot delete task: spec has no graph implementation");
    return false;
  }

  const task = spec.implementation.tasks.findById(entityId);
  if (!task) {
    console.error(`Task not found: ${entityId}`);
    return false;
  }

  // Remove the task from the collection
  // Bindings are automatically cleaned up via Valtio subscriptions
  return spec.implementation.tasks.removeById(entityId);
}

/**
 * Delete an input by its entity $id.
 *
 * Bindings referencing this input are automatically cleaned up via reactive subscriptions.
 */
export function deleteInput(entityId: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot delete input: no spec loaded");
    return false;
  }

  const input = spec.inputs.findById(entityId);
  if (!input) {
    console.error(`Input not found: ${entityId}`);
    return false;
  }

  // Remove the input from the collection
  // Bindings are automatically cleaned up via Valtio subscriptions
  return spec.inputs.removeById(entityId);
}

/**
 * Delete an output by its entity $id.
 *
 * Bindings referencing this output are automatically cleaned up via reactive subscriptions.
 */
export function deleteOutput(entityId: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot delete output: no spec loaded");
    return false;
  }

  const output = spec.outputs.findById(entityId);
  if (!output) {
    console.error(`Output not found: ${entityId}`);
    return false;
  }

  // Remove the output from the collection
  // Bindings are automatically cleaned up via Valtio subscriptions
  return spec.outputs.removeById(entityId);
}

/**
 * Delete an edge by its binding $id.
 *
 * Edge format: `edge_{binding.$id}`
 */
export function deleteEdge(edgeId: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot delete edge: spec has no graph implementation");
    return false;
  }

  // Extract binding ID from edge ID format: edge_{binding.$id}
  const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
  if (!bindingIdMatch) {
    console.error(`Invalid edge ID format: ${edgeId}`);
    return false;
  }

  const bindingId = bindingIdMatch[1];
  const binding = spec.implementation.bindings.findById(bindingId);

  if (!binding) {
    console.error(`Binding not found: ${bindingId}`);
    return false;
  }

  // Remove the binding
  return spec.implementation.bindings.unbind(binding.$id);
}

/**
 * Rename a task by its entity $id.
 */
export function renameTask(entityId: string, newName: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot rename: spec has no graph implementation");
    return false;
  }

  // Get task directly by $id
  const task = spec.implementation.tasks.findById(entityId);

  if (!task) {
    console.error(`Task not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingTask = spec.implementation.tasks.findByIndex(
    "name",
    newName,
  )[0];

  if (existingTask && existingTask.$id !== entityId) {
    console.error(`Task name already exists: ${newName}`);
    return false;
  }

  // Update the name - auto-reindexing happens via Valtio subscription
  task.name = newName;

  return true;
}

/**
 * Rename an input by its entity $id.
 */
export function renameInput(entityId: string, newName: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot rename: no spec loaded");
    return false;
  }

  // Get input directly by $id
  const input = spec.inputs.entities[entityId];

  if (!input) {
    console.error(`Input not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingInput = spec.inputs.findByIndex("name", newName)[0];

  if (existingInput && existingInput.$id !== entityId) {
    console.error(`Input name already exists: ${newName}`);
    return false;
  }

  // Update the name - auto-reindexing happens via Valtio subscription
  input.name = newName;

  return true;
}

/**
 * Rename the pipeline.
 */
export function renamePipeline(newName: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot rename: no spec loaded");
    return false;
  }

  spec.name = newName;
  return true;
}

/**
 * Update the pipeline description.
 */
export function updatePipelineDescription(description: string | undefined) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot update description: no spec loaded");
    return false;
  }

  spec.description = description;
  return true;
}

/**
 * Rename an output by its entity $id.
 *
 * Bindings use $id references, so renaming doesn't affect bindings.
 * The binding's targetPortName is updated during serialization.
 */
export function renameOutput(entityId: string, newName: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot rename: no spec loaded");
    return false;
  }

  // Get output directly by $id
  const output = spec.outputs.findById(entityId);

  if (!output) {
    console.error(`Output not found: ${entityId}`);
    return false;
  }

  // Check if new name is unique
  const existingOutput = spec.outputs.findByIndex("name", newName)[0];

  if (existingOutput && existingOutput.$id !== entityId) {
    console.error(`Output name already exists: ${newName}`);
    return false;
  }

  // Update the name - auto-reindexing happens via Valtio subscription
  // Note: Bindings use $id references, so no binding updates needed
  output.name = newName;

  return true;
}

/**
 * Helper to get binding type for a task argument.
 */
function getArgumentBindingType(
  bindings: BindingEntity[],
  argName: string,
): { type: "graphInput" | "taskOutput" | "literal"; binding?: BindingEntity } {
  const binding = bindings.find((b) => b.targetPortName === argName);
  if (!binding) {
    return { type: "literal" };
  }
  return { type: binding.bindingType as "graphInput" | "taskOutput", binding };
}

/**
 * Create a subgraph from selected task names.
 *
 * This is an advanced feature that:
 * 1. Creates a new ComponentSpec containing the selected tasks
 * 2. Creates a new task that references this subgraph spec
 * 3. Remaps external connections to/from the subgraph
 * 4. Removes the original tasks
 *
 * @param taskNames - Array of task names to include in the subgraph
 * @param subgraphName - Name for the new subgraph
 * @param position - Position for the new subgraph task node
 */
export function createSubgraph(
  taskNames: string[],
  subgraphName: string,
  position: XYPosition,
) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot create subgraph: spec has no graph implementation");
    return null;
  }

  if (taskNames.length === 0) {
    console.error("Cannot create subgraph: no tasks selected");
    return null;
  }

  const uniqueSubgraphName = generateUniqueTaskName(spec, subgraphName);

  // Collect selected tasks
  const selectedTasks = taskNames
    .map((name) => spec.implementation.tasks.findByIndex("name", name)[0])
    .filter(Boolean);

  if (selectedTasks.length === 0) {
    console.error("Cannot create subgraph: no valid tasks found");
    return null;
  }

  // Build set of selected task entity IDs for easy lookup
  const selectedTaskIds = new Set(selectedTasks.map((t) => t.$id));

  // create ComponentSpecEntity for the subgraph

  // find all sources of bindings to the selected tasks, that does not belong to the selected tasks
  // add inputs to the subgraph spec - one input per unique source port name

  // find all targets of bindings from the selected tasks, that does not belong to the selected tasks
  // add outputs to the subgraph spec - one output per unique target port name

  // move the selected tasks to the subgraph spec graph implementation

  // add subgraph spec as a task to the parent spec
  // restore connections from the subgraph to the parent spec


  return subgraphTask;
}
