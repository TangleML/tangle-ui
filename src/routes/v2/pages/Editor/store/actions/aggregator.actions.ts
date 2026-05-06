import type { XYPosition } from "@xyflow/react";

import type { ComponentSpec, Task } from "@/models/componentSpec";
import type { Argument } from "@/models/componentSpec/entities/types";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import {
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  AGGREGATOR_INPUT_PREFIX,
  createAggregatorInput,
  getNextAggregatorInputName,
} from "@/utils/aggregatorInputs";
import { isPipelineAggregator } from "@/utils/annotations";
import type {
  ComponentReference,
  ComponentSpec as ComponentSpecJson,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import { componentSpecToText } from "@/utils/yaml";

import { addInput } from "./io.actions";

interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

const AGG_INPUT_PREFIX = AGGREGATOR_INPUT_PREFIX;

export function isAggregatorTask(task: Task | undefined): boolean {
  if (!task) return false;
  const annotations = task.resolvedComponentSpec?.metadata?.annotations;
  return isPipelineAggregator(annotations);
}

/**
 * For an aggregator task being cloned (copy/paste, duplicate), return a fresh
 * componentRef + arguments with the dynamic agg_* inputs/arguments stripped —
 * a paste should start as a clean aggregator with zero connected inputs.
 * Returns null when the input isn't an aggregator (caller can keep originals).
 */
export function resetAggregatorOnClone(
  componentRef: ComponentReference,
  args: Argument[],
): { componentRef: ComponentReference; arguments: Argument[] } | null {
  const spec = componentRef.spec;
  if (!spec || !isPipelineAggregator(spec.metadata?.annotations)) return null;

  const strippedSpec: ComponentSpecJson = {
    ...spec,
    inputs: (spec.inputs ?? []).filter(
      (input) => !input.name.startsWith(AGG_INPUT_PREFIX),
    ),
  };

  return {
    componentRef: {
      ...componentRef,
      spec: strippedSpec,
      text: componentSpecToText(strippedSpec),
    },
    arguments: args.filter((a) => !a.name.startsWith(AGG_INPUT_PREFIX)),
  };
}

function isAggregatorAddInputHandle(handleId: string): boolean {
  return handleId === AGGREGATOR_ADD_INPUT_HANDLE_ID;
}

function appendAggregatorInputToTask(task: Task): string {
  const taskComponentSpec = task.resolvedComponentSpec;
  if (!taskComponentSpec) return "";

  const newInputName = getNextAggregatorInputName(
    taskComponentSpec.inputs ?? [],
  );
  const newInput = createAggregatorInput(newInputName);

  const clonedSpec: ComponentSpecJson = deepClone(taskComponentSpec);
  const updatedInputs = [...(clonedSpec.inputs ?? []), newInput];

  const orderedSpec: ComponentSpecJson = {
    name: clonedSpec.name,
    ...(clonedSpec.description && { description: clonedSpec.description }),
    ...(clonedSpec.metadata && { metadata: clonedSpec.metadata }),
    inputs: updatedInputs,
    ...(clonedSpec.outputs && { outputs: clonedSpec.outputs }),
    implementation: clonedSpec.implementation,
  };

  task.setComponentRef({
    ...task.componentRef,
    spec: orderedSpec,
    text: componentSpecToText(orderedSpec),
  });

  return newInputName;
}

function removeAggregatorInputFromTask(task: Task, inputName: string): void {
  const taskComponentSpec = task.resolvedComponentSpec;
  if (!taskComponentSpec) return;

  const clonedSpec: ComponentSpecJson = deepClone(taskComponentSpec);
  const filteredInputs = (clonedSpec.inputs ?? []).filter(
    (input) => input.name !== inputName,
  );

  const orderedSpec: ComponentSpecJson = {
    name: clonedSpec.name,
    ...(clonedSpec.description && { description: clonedSpec.description }),
    ...(clonedSpec.metadata && { metadata: clonedSpec.metadata }),
    inputs: filteredInputs,
    ...(clonedSpec.outputs && { outputs: clonedSpec.outputs }),
    implementation: clonedSpec.implementation,
  };

  task.removeArgumentByName(inputName);
  task.setComponentRef({
    ...task.componentRef,
    spec: orderedSpec,
    text: componentSpecToText(orderedSpec),
  });
}

function isDuplicateAggregatorSource(
  spec: ComponentSpec,
  taskEntityId: string,
  source: { entityId: string; portName: string },
): boolean {
  return spec.bindings.some(
    (binding) =>
      binding.targetEntityId === taskEntityId &&
      binding.targetPortName.startsWith(AGG_INPUT_PREFIX) &&
      binding.sourceEntityId === source.entityId &&
      binding.sourcePortName === source.portName,
  );
}

/**
 * If the connection targets an aggregator's special "+ Add Input" handle,
 * create a new agg_N input on the aggregator task and route the connection
 * to it. Returns true if the connection was handled here (caller should not
 * fall through to the regular connect flow).
 */
export function tryConnectAggregatorAddInput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  connection: ConnectionInfo,
): boolean {
  if (!isAggregatorAddInputHandle(connection.targetHandleId)) return false;

  const targetTask = spec.tasks.find((t) => t.$id === connection.targetNodeId);
  if (!isAggregatorTask(targetTask) || !targetTask) return false;

  const sourceOutputName = connection.sourceHandleId.replace(/^output_/, "");
  const source = {
    entityId: connection.sourceNodeId,
    portName: sourceOutputName,
  };

  if (isDuplicateAggregatorSource(spec, targetTask.$id, source)) {
    return true;
  }

  undo.withGroup("Connect to aggregator", () => {
    const newInputName = appendAggregatorInputToTask(targetTask);
    if (!newInputName) return;
    spec.connectNodes(source, {
      entityId: targetTask.$id,
      portName: newInputName,
    });
  });

  return true;
}

/**
 * Mirror of v1's handleAggregatorEdgeDeletion: when an edge connected to an
 * agg_N input is removed, also remove the input itself from the aggregator's
 * spec so the node UI stays clean.
 */
export function cleanupAggregatorInputForBinding(
  undo: UndoGroupable,
  spec: ComponentSpec,
  binding: {
    targetEntityId: string;
    targetPortName: string;
  },
): void {
  if (!binding.targetPortName.startsWith(AGG_INPUT_PREFIX)) return;

  const targetTask = spec.tasks.find((t) => t.$id === binding.targetEntityId);
  if (!isAggregatorTask(targetTask) || !targetTask) return;

  undo.withGroup("Remove aggregator input", () => {
    removeAggregatorInputFromTask(targetTask, binding.targetPortName);
  });
}

/**
 * Cmd-drop ghost behavior for the aggregator's "+ Add Input" handle: create a
 * new agg_N input on the task, a new graph Input node at the drop position,
 * and connect them.
 */
export function createConnectedAggregatorInputNode(
  undo: UndoGroupable,
  spec: ComponentSpec,
  taskEntityId: string,
  position: XYPosition,
): void {
  const task = spec.tasks.find((t) => t.$id === taskEntityId);
  if (!isAggregatorTask(task) || !task) return;

  undo.withGroup("Create aggregator input", () => {
    const newInputName = appendAggregatorInputToTask(task);
    if (!newInputName) return;

    const newGraphInput = addInput(undo, spec, position, newInputName);
    spec.connectNodes(
      { entityId: newGraphInput.$id, portName: newGraphInput.$id },
      { entityId: task.$id, portName: newInputName },
    );
  });
}
