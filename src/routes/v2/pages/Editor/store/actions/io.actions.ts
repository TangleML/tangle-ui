import type { XYPosition } from "@xyflow/react";

import {
  type ComponentSpec,
  Input,
  Output,
  type TypeSpecType,
} from "@/models/componentSpec";
import {
  generateUniqueInputName,
  generateUniqueOutputName,
} from "@/routes/v2/pages/Editor/store/nameUtils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

import { idGen } from "./utils";

export function addInput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Input {
  return undo.withGroup("Add input", () => {
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
  });
}

export function addOutput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  position: XYPosition,
  name?: string,
): Output {
  return undo.withGroup("Add output", () => {
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
  });
}

export function renameInput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return undo.withGroup("Rename input", () =>
    spec.renameInput(entityId, newName),
  );
}

export function renameOutput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  newName: string,
): boolean {
  return undo.withGroup("Rename output", () =>
    spec.renameOutput(entityId, newName),
  );
}

export function setInputDescription(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  description: string | undefined,
): void {
  undo.withGroup("Set input description", () => {
    const input = spec.inputs.find((i) => i.$id === entityId);
    input?.setDescription(description);
  });
}

export function setInputType(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  type: string | undefined,
): void {
  undo.withGroup("Set input type", () => {
    const input = spec.inputs.find((i) => i.$id === entityId);
    input?.setType(type);
  });
}

export function setInputDefaultValue(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  defaultValue: string | undefined,
): void {
  undo.withGroup("Set input default value", () => {
    const input = spec.inputs.find((i) => i.$id === entityId);
    input?.setDefaultValue(defaultValue);
  });
}

export function setOutputDescription(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
  description: string | undefined,
): void {
  undo.withGroup("Set output description", () => {
    const output = spec.outputs.find((o) => o.$id === entityId);
    output?.setDescription(description);
  });
}

export function deleteInput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
): boolean {
  return undo.withGroup("Delete input", () => spec.deleteInputById(entityId));
}

export function deleteOutput(
  undo: UndoGroupable,
  spec: ComponentSpec,
  entityId: string,
): boolean {
  return undo.withGroup("Delete output", () => spec.deleteOutputById(entityId));
}

export function createConnectedIONode(
  undo: UndoGroupable,
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

  undo.withGroup("Create connected IO node", () => {
    if (ioType === "input") {
      const inputSpec = taskComponentSpec?.inputs?.find(
        (i) => i.name === portName,
      );
      const newInput = addInput(undo, spec, position, portName);

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
      const newOutput = addOutput(undo, spec, position, portName);

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
  undo: UndoGroupable,
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

  undo.withGroup("Create input and connect", () => {
    const newInput = addInput(undo, spec, position, portName);
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
