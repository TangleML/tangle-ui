import type { XYPosition } from "@xyflow/react";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import type { InputEntity } from "@/providers/ComponentSpec/inputs";
import type { OutputEntity } from "@/providers/ComponentSpec/outputs";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import type { ComponentReference } from "@/utils/componentSpec";

import { editorStore, notifySpecChanged } from "./editorStore";

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
    notifySpecChanged();
    return;
  }

  // Try to find as input
  const input = spec.inputs.entities[entityId];
  if (input) {
    input.annotations.add({
      key: EDITOR_POSITION_ANNOTATION,
      value: JSON.stringify(position),
    });
    notifySpecChanged();
    return;
  }

  // Try to find as output
  const output = spec.outputs.entities[entityId];
  if (output) {
    output.annotations.add({
      key: EDITOR_POSITION_ANNOTATION,
      value: JSON.stringify(position),
    });
    notifySpecChanged();
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

  // Add default argument values from component spec inputs
  const inputs = componentRef.spec?.inputs ?? [];
  for (const input of inputs) {
    if (input.default !== undefined) {
      const arg = taskEntity.arguments.add({ name: input.name });
      arg.value = input.default;
    }
  }

  notifySpecChanged();
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

  notifySpecChanged();
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

  notifySpecChanged();
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

/**
 * Connect two nodes by creating an argument binding.
 *
 * Handles these connection types:
 * - Task output → Task input (taskOutput argument)
 * - Graph input → Task input (graphInput argument)
 * - Task output → Graph output (outputValues binding)
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
    // Look up source task by $id to get its name
    const sourceTask = spec.implementation.tasks.findById(sourceNodeId);
    if (!sourceTask) {
      console.error(`Source task not found: ${sourceNodeId}`);
      return false;
    }

    // Look up target output by $id to get its name
    const targetOutput = spec.outputs.findById(targetNodeId);
    if (!targetOutput) {
      console.error(`Target output not found: ${targetNodeId}`);
      return false;
    }

    spec.implementation.setOutputValue(
      targetOutput.name,
      sourceTask.name,
      sourceOutputName,
    );
    notifySpecChanged();
    return true;
  }

  // Target is a task - look up by $id
  const targetTask = spec.implementation.tasks.findById(targetNodeId);

  if (!targetTask) {
    console.error(`Target task not found: ${targetNodeId}`);
    return false;
  }

  // Find or create the argument
  let argument = targetTask.arguments.findByIndex("name", targetInputName)[0];
  if (!argument) {
    argument = targetTask.arguments.add({ name: targetInputName });
  }

  if (isSourceGraphInput) {
    // Graph input → Task input
    // Look up graph input by $id
    const graphInput = spec.inputs.findById(sourceNodeId);

    if (!graphInput) {
      console.error(`Graph input not found: ${sourceNodeId}`);
      return false;
    }

    argument.connectTo(graphInput);
    notifySpecChanged();
    return true;
  }

  // Task output → Task input
  // Look up source task by $id
  const sourceTask = spec.implementation.tasks.findById(sourceNodeId);

  if (!sourceTask) {
    console.error(`Source task not found: ${sourceNodeId}`);
    return false;
  }

  // Find the output entity in the source task's component spec
  const sourceComponentSpec = spec.findComponentSpecEntity(sourceTask.name);
  if (!sourceComponentSpec) {
    console.error(
      `Source component spec not found for task: ${sourceTask.name}`,
    );
    return false;
  }

  const sourceOutput = sourceComponentSpec.outputs.findByIndex(
    "name",
    sourceOutputName,
  )[0];

  if (!sourceOutput) {
    console.error(`Source output not found: ${sourceOutputName}`);
    return false;
  }

  argument.connectTo(sourceOutput);
  notifySpecChanged();
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
  notifySpecChanged();
  return true;
}

/**
 * Remove a graph output value binding.
 */
export function removeOutputConnection(graphOutputName: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    console.error("Cannot remove connection: spec has no graph implementation");
    return false;
  }

  spec.implementation.removeOutputValue(graphOutputName);
  notifySpecChanged();
  return true;
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

  task.name = newName;
  notifySpecChanged();
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

  input.name = newName;
  notifySpecChanged();
  return true;
}

/**
 * Rename an output by its entity $id.
 */
export function renameOutput(entityId: string, newName: string) {
  const { spec } = editorStore;

  if (!spec) {
    console.error("Cannot rename: no spec loaded");
    return false;
  }

  // Get output directly by $id
  const output = spec.outputs.entities[entityId];

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

  output.name = newName;
  notifySpecChanged();
  return true;
}

/**
 * Get the selected entity based on current selection.
 */
export function getSelectedEntity():
  | InputEntity
  | OutputEntity
  | ReturnType<typeof getTaskEntity>
  | null {
  const { spec, selectedNodeId, selectedNodeType } = editorStore;

  if (!spec || !selectedNodeId || !selectedNodeType) {
    return null;
  }

  switch (selectedNodeType) {
    case "task": {
      const taskName = selectedNodeId.replace(/^task_/, "");
      return getTaskEntity(taskName);
    }
    case "input": {
      const inputName = selectedNodeId.replace(/^input_/, "");
      return spec.inputs.findByIndex("name", inputName)[0] ?? null;
    }
    case "output": {
      const outputName = selectedNodeId.replace(/^output_/, "");
      return spec.outputs.findByIndex("name", outputName)[0] ?? null;
    }
    default:
      return null;
  }
}

/**
 * Get a task entity by name.
 */
function getTaskEntity(taskName: string) {
  const { spec } = editorStore;

  if (!hasGraphImplementation(spec)) {
    return null;
  }

  return spec.implementation.tasks.findByIndex("name", taskName)[0] ?? null;
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
  const selectedTaskNames = new Set(taskNames);

  // Collect selected tasks
  const selectedTasks = taskNames
    .map((name) => spec.implementation.tasks.findByIndex("name", name)[0])
    .filter(Boolean);

  if (selectedTasks.length === 0) {
    console.error("Cannot create subgraph: no valid tasks found");
    return null;
  }

  // Build the subgraph spec by serializing selected tasks
  const subgraphTasks: Record<
    string,
    ReturnType<(typeof selectedTasks)[0]["toJson"]>
  > = {};
  const subgraphInputs: Array<{ name: string; type?: string }> = [];
  const subgraphOutputs: Array<{ name: string; type?: string }> = [];
  const subgraphOutputValues: Record<
    string,
    { taskOutput: { taskId: string; outputName: string } }
  > = {};
  const subgraphArguments: Record<string, unknown> = {};

  for (const task of selectedTasks) {
    // Serialize the task
    subgraphTasks[task.name] = task.toJson();

    // Check task arguments for external connections
    const args = task.arguments.getAll();
    for (const arg of args) {
      const argType = arg.type;

      if (argType === "taskOutput") {
        // Check if source task is in the selection
        const argJson = arg.toJson();
        if (typeof argJson === "object" && "taskOutput" in argJson) {
          const sourceTaskId = argJson.taskOutput.taskId;
          if (!selectedTaskNames.has(sourceTaskId)) {
            // External connection - create subgraph input
            const inputName = `${sourceTaskId}_${argJson.taskOutput.outputName}`;
            if (!subgraphInputs.some((i) => i.name === inputName)) {
              subgraphInputs.push({ name: inputName });
              // Forward the external connection as subgraph argument
              subgraphArguments[inputName] = argJson;
            }
            // Update the task to use the new subgraph input
            const taskSpec = subgraphTasks[task.name];
            if (taskSpec.arguments) {
              taskSpec.arguments[arg.name] = {
                graphInput: { inputName },
              };
            }
          }
        }
      } else if (argType === "graphInput") {
        // Graph input from parent - pass through to subgraph
        const argJson = arg.toJson();
        if (typeof argJson === "object" && "graphInput" in argJson) {
          const inputName = argJson.graphInput.inputName;
          if (!subgraphInputs.some((i) => i.name === inputName)) {
            subgraphInputs.push({ name: inputName });
            // Forward the graph input as subgraph argument
            subgraphArguments[inputName] = argJson;
          }
        }
      }
    }

    // Check if task outputs are consumed by external tasks
    const taskOutputs = task.componentRef.spec?.outputs ?? [];
    for (const output of taskOutputs) {
      // Check all other tasks in the parent graph for connections to this output
      const allTasks = spec.implementation.tasks.getAll();
      for (const otherTask of allTasks) {
        if (selectedTaskNames.has(otherTask.name)) continue;

        const otherArgs = otherTask.arguments.getAll();
        for (const arg of otherArgs) {
          if (arg.type === "taskOutput") {
            const argJson = arg.toJson();
            if (
              typeof argJson === "object" &&
              "taskOutput" in argJson &&
              argJson.taskOutput.taskId === task.name &&
              argJson.taskOutput.outputName === output.name
            ) {
              // External task consumes this output - create subgraph output
              const outputName = `${task.name}_${output.name}`;
              if (!subgraphOutputs.some((o) => o.name === outputName)) {
                subgraphOutputs.push({ name: outputName });
                subgraphOutputValues[outputName] = {
                  taskOutput: {
                    taskId: task.name,
                    outputName: output.name,
                  },
                };
              }
            }
          }
        }
      }

      // Also check graph output values
      const graphOutputValues = spec.implementation.getOutputValues();
      for (const binding of graphOutputValues) {
        if (
          binding.taskId === task.name &&
          binding.taskOutputName === output.name
        ) {
          const outputName = `${task.name}_${output.name}`;
          if (!subgraphOutputs.some((o) => o.name === outputName)) {
            subgraphOutputs.push({ name: outputName });
            subgraphOutputValues[outputName] = {
              taskOutput: {
                taskId: task.name,
                outputName: output.name,
              },
            };
          }
        }
      }
    }
  }

  // Create the subgraph ComponentSpec
  const subgraphSpec: ComponentReference["spec"] = {
    name: uniqueSubgraphName,
    description: `Subgraph containing: ${taskNames.join(", ")}`,
    inputs: subgraphInputs.map((i) => ({ name: i.name, type: i.type })),
    outputs: subgraphOutputs.map((o) => ({ name: o.name, type: o.type })),
    implementation: {
      graph: {
        tasks: subgraphTasks,
        outputValues: subgraphOutputValues,
      },
    },
  };

  // Create the subgraph task
  const subgraphComponentRef: ComponentReference = {
    name: uniqueSubgraphName,
    spec: subgraphSpec,
  };

  const subgraphTask = addTask(subgraphComponentRef, position);
  if (!subgraphTask) {
    console.error("Failed to create subgraph task");
    return null;
  }

  // Set the subgraph arguments (forwarding external connections)
  for (const [argName, argValue] of Object.entries(subgraphArguments)) {
    const arg = subgraphTask.arguments.add({ name: argName });

    if (typeof argValue === "object" && argValue !== null) {
      if ("taskOutput" in argValue) {
        // Connect to external task output
        const taskOutput = argValue as {
          taskOutput: { taskId: string; outputName: string };
        };
        const sourceTask = spec.implementation.tasks.findByIndex(
          "name",
          taskOutput.taskOutput.taskId,
        )[0];
        if (sourceTask) {
          const sourceComponentSpec = spec.findComponentSpecEntity(
            sourceTask.name,
          );
          const sourceOutput = sourceComponentSpec?.outputs.findByIndex(
            "name",
            taskOutput.taskOutput.outputName,
          )[0];
          if (sourceOutput) {
            arg.connectTo(sourceOutput);
          }
        }
      } else if ("graphInput" in argValue) {
        // Connect to graph input
        const graphInput = argValue as { graphInput: { inputName: string } };
        const inputEntity = spec.inputs.findByIndex(
          "name",
          graphInput.graphInput.inputName,
        )[0];
        if (inputEntity) {
          arg.connectTo(inputEntity);
        }
      }
    }
  }

  // Update external tasks to connect to subgraph outputs instead of original tasks
  const allTasks = spec.implementation.tasks.getAll();
  for (const task of allTasks) {
    if (selectedTaskNames.has(task.name) || task.name === subgraphTask.name)
      continue;

    const args = task.arguments.getAll();
    for (const arg of args) {
      if (arg.type === "taskOutput") {
        const argJson = arg.toJson();
        if (typeof argJson === "object" && "taskOutput" in argJson) {
          const sourceTaskId = argJson.taskOutput.taskId;
          const sourceOutputName = argJson.taskOutput.outputName;

          if (selectedTaskNames.has(sourceTaskId)) {
            // Find the corresponding subgraph output
            const subgraphOutputName = `${sourceTaskId}_${sourceOutputName}`;
            const subgraphComponentSpec = spec.findComponentSpecEntity(
              subgraphTask.name,
            );
            const subgraphOutput = subgraphComponentSpec?.outputs.findByIndex(
              "name",
              subgraphOutputName,
            )[0];

            if (subgraphOutput) {
              arg.connectTo(subgraphOutput);
            }
          }
        }
      }
    }
  }

  // Update graph output values to point to subgraph
  const graphOutputValues = spec.implementation.getOutputValues();
  for (const binding of graphOutputValues) {
    if (selectedTaskNames.has(binding.taskId)) {
      const subgraphOutputName = `${binding.taskId}_${binding.taskOutputName}`;
      spec.implementation.setOutputValue(
        binding.outputName,
        subgraphTask.name,
        subgraphOutputName,
      );
    }
  }

  // Remove original tasks (we can't actually remove from collections in this MVP,
  // so we'll mark them as disabled or just leave them - full implementation would
  // require collection removal methods)
  // For MVP, we log a warning
  console.warn(
    "MVP limitation: Original tasks are not removed from the graph. " +
      "Full implementation would require collection removal methods.",
  );

  return subgraphTask;
}
