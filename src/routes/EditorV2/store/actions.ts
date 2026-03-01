import type { XYPosition } from "@xyflow/react";
import { proxy } from "valtio";

import { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { TaskEntity } from "@/providers/ComponentSpec/tasks";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";

import { getCurrentSpec } from "./navigationStore";

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
 * Uses the current spec from navigation state.
 */
export function updateNodePosition(entityId: string, position: XYPosition) {
  const spec = getCurrentSpec();
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
    const existing = input.annotations
      .getAll()
      .find((a) => a.key === EDITOR_POSITION_ANNOTATION);
    if (existing) {
      existing.value = JSON.stringify(position);
    } else {
      input.annotations.add({
        key: EDITOR_POSITION_ANNOTATION,
        value: JSON.stringify(position),
      });
    }
    return;
  }

  // Try to find as output
  const output = spec.outputs.entities[entityId];
  if (output) {
    const existing = output.annotations
      .getAll()
      .find((a) => a.key === EDITOR_POSITION_ANNOTATION);
    if (existing) {
      existing.value = JSON.stringify(position);
    } else {
      output.annotations.add({
        key: EDITOR_POSITION_ANNOTATION,
        value: JSON.stringify(position),
      });
    }
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
 * Uses the current spec from navigation state.
 */
export function addTask(
  componentRef: ComponentReference,
  position: XYPosition,
) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 */
export function addInput(position: XYPosition, name?: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 */
export function addOutput(position: XYPosition, name?: string) {
  const spec = getCurrentSpec();

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
export function getNodeTypeFromId(
  nodeId: string,
): "input" | "output" | "task" | null {
  if (nodeId.includes(".inputs_")) return "input";
  if (nodeId.includes(".outputs_")) return "output";
  if (nodeId.includes(".tasks_")) return "task";
  return null;
}

// =============================================================================
// UNIFIED BINDING API
// =============================================================================

// =============================================================================
// CONNECTION API
// =============================================================================

/**
 * Connect two nodes by creating a binding.
 * Uses the current spec from navigation state.
 *
 * Handles these connection types:
 * - Task output → Task input (taskOutput binding)
 * - Graph input → Task input (graphInput binding)
 * - Task output → Graph output (outputValue binding)
 *
 * Node IDs are entity $ids in the format: root.{specName}.{collection}_{number}
 */
export function connectNodes(connection: ConnectionInfo) {
  const spec = getCurrentSpec();

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

    // Use rebind to replace any existing connection to the output
    spec.implementation.bindings.rebind(
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
  const existingArg = targetTask.arguments.findByIndex(
    "name",
    targetInputName,
  )[0];
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

    // Use rebind to replace any existing connection to the task input
    spec.implementation.bindings.rebind(
      { entityId: sourceNodeId, portName: graphInput.name },
      { entityId: targetNodeId, portName: targetInputName },
    );

    return true;
  }

  // Task output → Task input
  // Use rebind to replace any existing connection to the task input
  spec.implementation.bindings.rebind(
    { entityId: sourceNodeId, portName: sourceOutputName },
    { entityId: targetNodeId, portName: targetInputName },
  );

  return true;
}

/**
 * Delete a task by its entity $id.
 * Uses the current spec from navigation state.
 *
 * Bindings referencing this task are automatically cleaned up via reactive subscriptions.
 */
export function deleteTask(entityId: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 *
 * Bindings referencing this input are automatically cleaned up via reactive subscriptions.
 */
export function deleteInput(entityId: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 *
 * Bindings referencing this output are automatically cleaned up via reactive subscriptions.
 */
export function deleteOutput(entityId: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 *
 * Edge format: `edge_{binding.$id}`
 */
export function deleteEdge(edgeId: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 */
export function renameTask(entityId: string, newName: string) {
  const spec = getCurrentSpec();

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
 * Uses the current spec from navigation state.
 */
export function renameInput(entityId: string, newName: string) {
  const spec = getCurrentSpec();

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
 * Rename the current spec (pipeline or subgraph).
 * Uses the current spec from navigation state.
 */
export function renamePipeline(newName: string) {
  const spec = getCurrentSpec();

  if (!spec) {
    console.error("Cannot rename: no spec loaded");
    return false;
  }

  spec.name = newName;
  return true;
}

/**
 * Update the current spec description.
 * Uses the current spec from navigation state.
 */
export function updatePipelineDescription(description: string | undefined) {
  const spec = getCurrentSpec();

  if (!spec) {
    console.error("Cannot update description: no spec loaded");
    return false;
  }

  spec.description = description;
  return true;
}

/**
 * Rename an output by its entity $id.
 * Uses the current spec from navigation state.
 *
 * Bindings use $id references, so renaming doesn't affect bindings.
 * The binding's targetPortName is updated during serialization.
 */
export function renameOutput(entityId: string, newName: string) {
  const spec = getCurrentSpec();

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
 * Create a subgraph from selected task names.
 * Uses the current spec from navigation state.
 *
 * This is an advanced feature that:
 * 1. Creates a new ComponentSpec containing the selected tasks
 * 2. Creates a new task that references this subgraph spec
 * 3. Remaps external connections to/from the subgraph
 * 4. Moves the original tasks (using detach/attach)
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
  const spec = getCurrentSpec();

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

  // Analyze bindings to find external connections
  const allBindings = spec.implementation.bindings.getAll();

  // Find incoming bindings: bindings targeting selected tasks from outside the selection
  // These become subgraph inputs
  const incomingBindings = allBindings.filter(
    (b) =>
      selectedTaskIds.has(b.targetEntityId) &&
      !selectedTaskIds.has(b.sourceEntityId),
  );

  // Find outgoing bindings: bindings from selected tasks to outside the selection
  // These become subgraph outputs
  const outgoingBindings = allBindings.filter(
    (b) =>
      selectedTaskIds.has(b.sourceEntityId) &&
      !selectedTaskIds.has(b.targetEntityId),
  );

  // Find internal bindings: bindings between selected tasks
  const internalBindings = allBindings.filter(
    (b) =>
      selectedTaskIds.has(b.sourceEntityId) &&
      selectedTaskIds.has(b.targetEntityId),
  );

  // Create the subgraph ComponentSpec
  const subgraphSpecEntity = proxy(
    new ComponentSpecEntity(spec.generateId(), spec, {
      name: uniqueSubgraphName,
    }),
  ).populate({
    name: uniqueSubgraphName,
    description: `Subgraph containing: ${taskNames.join(", ")}`,
  });

  // Register the subgraph spec entity
  spec.registerEntity(subgraphSpecEntity);

  // Group incoming bindings by source - each group becomes one subgraph input
  const incomingBySource = Object.groupBy(
    incomingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  // Create subgraph inputs from grouped bindings
  const subgraphInputGroups = Object.values(incomingBySource)
    .filter((bindings): bindings is NonNullable<typeof bindings> => !!bindings)
    .map((bindings) => {
      const first = bindings[0];
      // For graph inputs, use the input name; for task outputs, use "taskName_outputName"
      const inputName = first.sourcePortName;

      const inputEntity = subgraphSpecEntity.inputs.add({ name: inputName });
      return { inputEntity, bindings };
    });

  // Group outgoing bindings by source - each group becomes one subgraph output
  const outgoingBySource = Object.groupBy(
    outgoingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  // Create subgraph outputs from grouped bindings
  const subgraphOutputGroups = Object.values(outgoingBySource)
    .filter((bindings): bindings is NonNullable<typeof bindings> => !!bindings)
    .map((bindings) => {
      const first = bindings[0];
      const outputName = first.sourcePortName;

      const outputEntity = subgraphSpecEntity.outputs.add({ name: outputName });
      return { outputEntity, bindings };
    });

  // Create GraphImplementation for the subgraph
  subgraphSpecEntity.implementation = proxy(
    new GraphImplementation(subgraphSpecEntity),
  );

  // Remove boundary bindings from parent BEFORE detaching tasks
  // (otherwise the binding watch would auto-cleanup when tasks are detached)
  for (const binding of incomingBindings) {
    spec.implementation.bindings.unbind(binding.$id);
  }
  for (const binding of outgoingBindings) {
    spec.implementation.bindings.unbind(binding.$id);
  }

  // Detach internal bindings from parent and attach to subgraph
  // (tasks still have the same $ids, so bindings reference them correctly)
  for (const binding of internalBindings) {
    const detached = spec.implementation.bindings.detach(binding);
    subgraphSpecEntity.implementation.bindings.attach(detached);
  }

  // Detach tasks from parent and attach to subgraph
  // The attach method updates the task's context automatically
  for (const task of selectedTasks) {
    const detached = spec.implementation.tasks.detach(task);
    subgraphSpecEntity.implementation.tasks.attach(detached);
  }

  // Create bindings from subgraph inputs to moved tasks
  for (const { inputEntity, bindings } of subgraphInputGroups) {
    for (const binding of bindings) {
      subgraphSpecEntity.implementation.bindings.rebind(
        { entityId: inputEntity.$id, portName: inputEntity.name },
        { entityId: binding.targetEntityId, portName: binding.targetPortName },
      );
    }
  }

  // Create bindings from moved tasks to subgraph outputs (outputValues)
  // All bindings in a group share the same source, so use the first one
  for (const { outputEntity, bindings } of subgraphOutputGroups) {
    const first = bindings[0];
    subgraphSpecEntity.implementation.bindings.rebind(
      { entityId: first.sourceEntityId, portName: first.sourcePortName },
      { entityId: outputEntity.$id, portName: outputEntity.name },
    );
  }

  // Build the ComponentSpec for the subgraph task's componentRef
  const subgraphComponentSpec: ComponentSpec = subgraphSpecEntity.toJson();

  // Add subgraph as a task in the parent spec
  const subgraphTask = spec.implementation.tasks.add({
    name: uniqueSubgraphName,
    componentRef: { spec: subgraphComponentSpec },
    annotations: {
      [EDITOR_POSITION_ANNOTATION]: JSON.stringify(position),
    },
  });

  // Restore connections from the parent to the subgraph task

  // Connect external sources to subgraph task inputs
  // All bindings in a group share the same source, so one binding per group
  for (const { inputEntity, bindings } of subgraphInputGroups) {
    subgraphTask.arguments.add({ name: inputEntity.name });
    const first = bindings[0];
    spec.implementation.bindings.rebind(
      { entityId: first.sourceEntityId, portName: first.sourcePortName },
      { entityId: subgraphTask.$id, portName: inputEntity.name },
    );
  }

  // Connect subgraph task outputs to external targets
  for (const { outputEntity, bindings } of subgraphOutputGroups) {
    for (const binding of bindings) {
      // If target is a graph output, create outputValue binding
      // Otherwise, create task argument binding

      if (binding.target instanceof TaskEntity) {
        // Target is another task - create binding to its input
        // Ensure target task has the argument
        if (
          !binding.target.arguments.findByIndex(
            "name",
            binding.targetPortName,
          )[0]
        ) {
          binding.target.arguments.add({ name: binding.targetPortName });
        }
      }

      spec.implementation.bindings.rebind(
        { entityId: subgraphTask.$id, portName: outputEntity.name },
        {
          entityId: binding.targetEntityId,
          portName: binding.targetPortName,
        },
      );
    }
  }

  return subgraphTask;
}
