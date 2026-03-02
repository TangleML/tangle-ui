/**
 * Command Pattern implementation for undo/redo functionality.
 *
 * Each Command encapsulates an action that can be executed and undone.
 * Commands are managed by the CommandManager which maintains undo/redo stacks.
 *
 * All commands receive the ComponentSpec in their constructor and store it
 * for use in execute() and undo() operations.
 */

import type { XYPosition } from "@xyflow/react";

import type {
  ArgumentType,
  ComponentReference,
  ComponentSpec,
  TypeSpecType,
} from "@/models/componentSpec";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

import {
  addInput,
  addOutput,
  addTask,
  type ConnectionInfo,
  connectNodes,
  createSubgraph,
  deleteEdge,
  deleteInput,
  deleteOutput,
  deleteTask,
  getNodeTypeFromId,
  renameInput,
  renameOutput,
  renamePipeline,
  renameTask,
  updateNodePosition,
  updatePipelineDescription,
} from "./actions";

// =============================================================================
// COMMAND INTERFACE
// =============================================================================

/**
 * Command interface for undo/redo operations.
 * Each command knows how to execute itself and how to undo itself.
 */
export interface Command {
  /** Human-readable description for the history UI */
  readonly description: string;

  /**
   * Execute the command.
   * @returns true if execution succeeded, false if it failed validation
   */
  execute(): boolean;

  /**
   * Undo the command, reverting to the previous state.
   * @returns true if undo succeeded, false if it failed
   */
  undo(): boolean;
}

// =============================================================================
// SNAPSHOT TYPES FOR UNDO
// =============================================================================

/** Snapshot of an annotation for undo operations */
export interface AnnotationSnapshot {
  key: string;
  value: string;
}

/** Snapshot of an argument for undo operations */
export interface ArgumentSnapshot {
  name: string;
  value?: ArgumentType;
}

/** Snapshot of a binding for undo operations */
export interface BindingSnapshot {
  bindingId: string;
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

/** Snapshot of a task entity for undo operations */
export interface TaskSnapshot {
  entityId: string;
  name: string;
  componentRef: ComponentReference;
  position: XYPosition;
  annotations: AnnotationSnapshot[];
  arguments: ArgumentSnapshot[];
  /** Bindings where this task is source or target */
  connectedBindings: BindingSnapshot[];
}

/** Snapshot of an input entity for undo operations */
export interface InputSnapshot {
  entityId: string;
  name: string;
  position: XYPosition;
  annotations: AnnotationSnapshot[];
  type?: TypeSpecType;
  description?: string;
  defaultValue?: string;
  optional?: boolean;
  /** Bindings where this input is the source */
  connectedBindings: BindingSnapshot[];
}

/** Snapshot of an output entity for undo operations */
export interface OutputSnapshot {
  entityId: string;
  name: string;
  position: XYPosition;
  annotations: AnnotationSnapshot[];
  type?: TypeSpecType;
  description?: string;
  /** Bindings where this output is the target */
  connectedBindings: BindingSnapshot[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract position from annotations array.
 */
function getPositionFromAnnotations(
  annotations: { key: string; value: unknown }[],
): XYPosition {
  const posAnnotation = annotations.find(
    (a) => a.key === EDITOR_POSITION_ANNOTATION,
  );
  if (posAnnotation) {
    try {
      return JSON.parse(String(posAnnotation.value)) as XYPosition;
    } catch {
      // Fall through to default
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Capture a task snapshot for undo operations.
 */
export function captureTaskSnapshot(
  spec: ComponentSpec,
  entityId: string,
): TaskSnapshot | null {
  const task = spec.tasks.find((t) => t.$id === entityId);
  if (!task) return null;

  // Capture annotations (cast value to string as that's what the entity stores)
  const annotations: AnnotationSnapshot[] = task.annotations.all.map((a) => ({
    key: a.key,
    value: String(a.value),
  }));

  // Capture arguments
  const args: ArgumentSnapshot[] = task.arguments.all.map((a) => ({
    name: a.name,
    value: a.value,
  }));

  // Capture connected bindings (as source or target)
  const allBindings = spec.bindings.all;
  const connectedBindings: BindingSnapshot[] = allBindings
    .filter(
      (b) => b.sourceEntityId === entityId || b.targetEntityId === entityId,
    )
    .map((b) => ({
      bindingId: b.$id,
      sourceEntityId: b.sourceEntityId,
      sourcePortName: b.sourcePortName,
      targetEntityId: b.targetEntityId,
      targetPortName: b.targetPortName,
    }));

  return {
    entityId,
    name: task.name,
    componentRef: task.componentRef,
    position: getPositionFromAnnotations(annotations),
    annotations,
    arguments: args,
    connectedBindings,
  };
}

/**
 * Capture an input snapshot for undo operations.
 */
export function captureInputSnapshot(
  spec: ComponentSpec,
  entityId: string,
): InputSnapshot | null {
  const input = spec.inputs.find((i) => i.$id === entityId);
  if (!input) return null;

  // Capture annotations
  const annotations: AnnotationSnapshot[] = input.annotations.all.map((a) => ({
    key: a.key,
    value: String(a.value),
  }));

  // Capture connected bindings (as source)
  const allBindings = spec.bindings.all;
  const connectedBindings: BindingSnapshot[] = allBindings
    .filter((b) => b.sourceEntityId === entityId)
    .map((b) => ({
      bindingId: b.$id,
      sourceEntityId: b.sourceEntityId,
      sourcePortName: b.sourcePortName,
      targetEntityId: b.targetEntityId,
      targetPortName: b.targetPortName,
    }));

  return {
    entityId,
    name: input.name,
    position: getPositionFromAnnotations(annotations),
    annotations,
    type: input.type,
    description: input.description,
    defaultValue: input.defaultValue,
    optional: input.optional,
    connectedBindings,
  };
}

/**
 * Capture an output snapshot for undo operations.
 */
export function captureOutputSnapshot(
  spec: ComponentSpec,
  entityId: string,
): OutputSnapshot | null {
  const output = spec.outputs.find((o) => o.$id === entityId);
  if (!output) return null;

  // Capture annotations
  const annotations: AnnotationSnapshot[] = output.annotations.all.map((a) => ({
    key: a.key,
    value: String(a.value),
  }));

  // Capture connected bindings (as target)
  const allBindings = spec.bindings.all;
  const connectedBindings: BindingSnapshot[] = allBindings
    .filter((b) => b.targetEntityId === entityId)
    .map((b) => ({
      bindingId: b.$id,
      sourceEntityId: b.sourceEntityId,
      sourcePortName: b.sourcePortName,
      targetEntityId: b.targetEntityId,
      targetPortName: b.targetPortName,
    }));

  return {
    entityId,
    name: output.name,
    position: getPositionFromAnnotations(annotations),
    annotations,
    type: output.type,
    description: output.description,
    connectedBindings,
  };
}

/**
 * Capture a binding snapshot for undo operations.
 */
export function captureBindingSnapshot(
  spec: ComponentSpec,
  edgeId: string,
): BindingSnapshot | null {
  // Extract binding ID from edge ID format: edge_{binding.$id}
  const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
  if (!bindingIdMatch) return null;

  const bindingId = bindingIdMatch[1];
  const binding = spec.bindings.find((b) => b.$id === bindingId);
  if (!binding) return null;

  return {
    bindingId: binding.$id,
    sourceEntityId: binding.sourceEntityId,
    sourcePortName: binding.sourcePortName,
    targetEntityId: binding.targetEntityId,
    targetPortName: binding.targetPortName,
  };
}

// =============================================================================
// RENAME COMMANDS
// =============================================================================

/**
 * Command to rename a task.
 */
export class RenameTaskCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename task to "${newName}"`;
  }

  execute(): boolean {
    const task = this.spec.tasks.find((t) => t.$id === this.entityId);
    if (!task) return false;

    // Capture previous name before executing
    this.previousName = task.name;

    return renameTask(this.spec, this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameTask(this.spec, this.entityId, this.previousName);
  }
}

/**
 * Command to rename an input.
 */
export class RenameInputCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename input to "${newName}"`;
  }

  execute(): boolean {
    const input = this.spec.inputs.find((i) => i.$id === this.entityId);
    if (!input) return false;

    // Capture previous name before executing
    this.previousName = input.name;

    return renameInput(this.spec, this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameInput(this.spec, this.entityId, this.previousName);
  }
}

/**
 * Command to rename an output.
 */
export class RenameOutputCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename output to "${newName}"`;
  }

  execute(): boolean {
    const output = this.spec.outputs.find((o) => o.$id === this.entityId);
    if (!output) return false;

    // Capture previous name before executing
    this.previousName = output.name;

    return renameOutput(this.spec, this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameOutput(this.spec, this.entityId, this.previousName);
  }
}

/**
 * Command to rename the pipeline.
 */
export class RenamePipelineCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly newName: string,
  ) {
    this.description = `Rename pipeline to "${newName}"`;
  }

  execute(): boolean {
    // Capture previous name before executing
    this.previousName = this.spec.name;

    return renamePipeline(this.spec, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renamePipeline(this.spec, this.previousName);
  }
}

/**
 * Command to update pipeline description.
 */
export class UpdateDescriptionCommand implements Command {
  readonly description: string;
  private previousDescription: string | undefined = undefined;
  private hadPreviousValue = false;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly newDescription: string | undefined,
  ) {
    this.description = newDescription
      ? "Update pipeline description"
      : "Clear pipeline description";
  }

  execute(): boolean {
    // Capture previous description before executing
    this.hadPreviousValue = true;
    this.previousDescription = this.spec.description;

    return updatePipelineDescription(this.spec, this.newDescription);
  }

  undo(): boolean {
    if (!this.hadPreviousValue) return false;
    return updatePipelineDescription(this.spec, this.previousDescription);
  }
}

// =============================================================================
// POSITION COMMANDS
// =============================================================================

/**
 * Command to update a node's position.
 */
export class UpdateNodePositionCommand implements Command {
  readonly description = "Move node";
  private previousPosition: XYPosition | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
    private readonly newPosition: XYPosition,
  ) {}

  execute(): boolean {
    // Find the entity and capture its current position
    const task = this.spec.tasks.find((t) => t.$id === this.entityId);
    const input = this.spec.inputs.find((i) => i.$id === this.entityId);
    const output = this.spec.outputs.find((o) => o.$id === this.entityId);

    const entity = task ?? input ?? output;
    if (!entity) return false;

    // Get current position from annotations
    const posAnnotation = entity.annotations.all.find(
      (a) => a.key === EDITOR_POSITION_ANNOTATION,
    );

    if (posAnnotation) {
      try {
        this.previousPosition = JSON.parse(
          String(posAnnotation.value),
        ) as XYPosition;
      } catch {
        this.previousPosition = { x: 0, y: 0 };
      }
    } else {
      this.previousPosition = { x: 0, y: 0 };
    }

    updateNodePosition(this.spec, this.entityId, this.newPosition);
    return true;
  }

  undo(): boolean {
    if (!this.previousPosition) return false;
    updateNodePosition(this.spec, this.entityId, this.previousPosition);
    return true;
  }
}

// =============================================================================
// ADD COMMANDS
// =============================================================================

/**
 * Command to add a task.
 */
export class AddTaskCommand implements Command {
  readonly description: string;
  private createdEntityId: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly componentRef: ComponentReference,
    private readonly position: XYPosition,
  ) {
    const name = componentRef.spec?.name ?? componentRef.name ?? "Task";
    this.description = `Add "${name}" task`;
  }

  execute(): boolean {
    const taskEntity = addTask(this.spec, this.componentRef, this.position);
    this.createdEntityId = taskEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteTask(this.spec, this.createdEntityId);
  }
}

/**
 * Command to add an input node.
 */
export class AddInputCommand implements Command {
  readonly description: string;
  private createdEntityId: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly position: XYPosition,
    private readonly name?: string,
  ) {
    this.description = name ? `Add "${name}" input` : "Add input";
  }

  execute(): boolean {
    const inputEntity = addInput(this.spec, this.position, this.name);
    this.createdEntityId = inputEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteInput(this.spec, this.createdEntityId);
  }
}

/**
 * Command to add an output node.
 */
export class AddOutputCommand implements Command {
  readonly description: string;
  private createdEntityId: string | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly position: XYPosition,
    private readonly name?: string,
  ) {
    this.description = name ? `Add "${name}" output` : "Add output";
  }

  execute(): boolean {
    const outputEntity = addOutput(this.spec, this.position, this.name);
    this.createdEntityId = outputEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteOutput(this.spec, this.createdEntityId);
  }
}

// =============================================================================
// DELETE COMMANDS
// =============================================================================

/**
 * Command to delete a task.
 * Captures the task snapshot before deletion for undo.
 */
export class DeleteTaskCommand implements Command {
  readonly description: string;
  private snapshot: TaskSnapshot | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
  ) {
    this.description = "Delete task";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureTaskSnapshot(this.spec, this.entityId);
    if (!this.snapshot) return false;

    return deleteTask(this.spec, this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    // Re-add the task
    const taskEntity = addTask(
      this.spec,
      this.snapshot.componentRef,
      this.snapshot.position,
    );

    // Restore the original name if different
    if (taskEntity.name !== this.snapshot.name) {
      renameTask(this.spec, taskEntity.$id, this.snapshot.name);
    }

    // Restore arguments
    for (const arg of this.snapshot.arguments) {
      const existingArg = taskEntity.arguments.find((a) => a.name === arg.name);
      if (existingArg) {
        const idx = taskEntity.arguments.findIndex((a) => a.name === arg.name);
        taskEntity.arguments.update(idx, { value: arg.value });
      } else {
        taskEntity.arguments.add({ name: arg.name, value: arg.value });
      }
    }

    // Restore non-position annotations
    for (const ann of this.snapshot.annotations) {
      if (ann.key !== EDITOR_POSITION_ANNOTATION) {
        taskEntity.annotations.add({ key: ann.key, value: ann.value });
      }
    }

    // Restore bindings that referenced this task
    // Need to remap from old entity ID to new entity ID
    for (const binding of this.snapshot.connectedBindings) {
      const newSourceId =
        binding.sourceEntityId === this.snapshot.entityId
          ? taskEntity.$id
          : binding.sourceEntityId;
      const newTargetId =
        binding.targetEntityId === this.snapshot.entityId
          ? taskEntity.$id
          : binding.targetEntityId;

      // Only restore if both entities still exist
      const sourceExists =
        this.spec.inputs.find((i) => i.$id === newSourceId) ??
        this.spec.tasks.find((t) => t.$id === newSourceId);
      const targetExists =
        this.spec.outputs.find((o) => o.$id === newTargetId) ??
        this.spec.tasks.find((t) => t.$id === newTargetId);

      if (sourceExists && targetExists) {
        connectNodes(this.spec, {
          sourceNodeId: newSourceId,
          sourceHandleId: `output_${binding.sourcePortName}`,
          targetNodeId: newTargetId,
          targetHandleId: `input_${binding.targetPortName}`,
        });
      }
    }

    return true;
  }
}

/**
 * Command to delete an input node.
 * Captures the input snapshot before deletion for undo.
 */
export class DeleteInputCommand implements Command {
  readonly description: string;
  private snapshot: InputSnapshot | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
  ) {
    this.description = "Delete input";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureInputSnapshot(this.spec, this.entityId);
    if (!this.snapshot) return false;

    return deleteInput(this.spec, this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    // Re-add the input
    const inputEntity = addInput(
      this.spec,
      this.snapshot.position,
      this.snapshot.name,
    );

    // Restore properties
    if (this.snapshot.type !== undefined && this.snapshot.type !== null) {
      inputEntity.type = this.snapshot.type;
    }
    if (
      this.snapshot.description !== undefined &&
      this.snapshot.description !== null
    ) {
      inputEntity.description = this.snapshot.description;
    }
    if (
      this.snapshot.defaultValue !== undefined &&
      this.snapshot.defaultValue !== null
    ) {
      inputEntity.defaultValue = this.snapshot.defaultValue;
    }
    if (this.snapshot.optional !== undefined) {
      inputEntity.optional = this.snapshot.optional;
    }

    // Restore non-position annotations
    for (const ann of this.snapshot.annotations) {
      if (ann.key !== EDITOR_POSITION_ANNOTATION) {
        inputEntity.annotations.add({ key: ann.key, value: ann.value });
      }
    }

    // Restore bindings
    for (const binding of this.snapshot.connectedBindings) {
      const newSourceId =
        binding.sourceEntityId === this.snapshot.entityId
          ? inputEntity.$id
          : binding.sourceEntityId;

      // Check if target still exists
      const targetExists =
        this.spec.outputs.find((o) => o.$id === binding.targetEntityId) ??
        this.spec.tasks.find((t) => t.$id === binding.targetEntityId);

      if (targetExists) {
        connectNodes(this.spec, {
          sourceNodeId: newSourceId,
          sourceHandleId: `output_${binding.sourcePortName}`,
          targetNodeId: binding.targetEntityId,
          targetHandleId: `input_${binding.targetPortName}`,
        });
      }
    }

    return true;
  }
}

/**
 * Command to delete an output node.
 * Captures the output snapshot before deletion for undo.
 */
export class DeleteOutputCommand implements Command {
  readonly description: string;
  private snapshot: OutputSnapshot | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly entityId: string,
  ) {
    this.description = "Delete output";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureOutputSnapshot(this.spec, this.entityId);
    if (!this.snapshot) return false;

    return deleteOutput(this.spec, this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    // Re-add the output
    const outputEntity = addOutput(
      this.spec,
      this.snapshot.position,
      this.snapshot.name,
    );

    // Restore properties
    if (this.snapshot.type !== undefined && this.snapshot.type !== null) {
      outputEntity.type = this.snapshot.type;
    }
    if (
      this.snapshot.description !== undefined &&
      this.snapshot.description !== null
    ) {
      outputEntity.description = this.snapshot.description;
    }

    // Restore non-position annotations
    for (const ann of this.snapshot.annotations) {
      if (ann.key !== EDITOR_POSITION_ANNOTATION) {
        outputEntity.annotations.add({ key: ann.key, value: ann.value });
      }
    }

    // Restore bindings
    for (const binding of this.snapshot.connectedBindings) {
      const newTargetId =
        binding.targetEntityId === this.snapshot.entityId
          ? outputEntity.$id
          : binding.targetEntityId;

      // Check if source still exists
      const sourceExists =
        this.spec.inputs.find((i) => i.$id === binding.sourceEntityId) ??
        this.spec.tasks.find((t) => t.$id === binding.sourceEntityId);

      if (sourceExists) {
        connectNodes(this.spec, {
          sourceNodeId: binding.sourceEntityId,
          sourceHandleId: `output_${binding.sourcePortName}`,
          targetNodeId: newTargetId,
          targetHandleId: `input_${binding.targetPortName}`,
        });
      }
    }

    return true;
  }
}

/**
 * Command to delete an edge (binding).
 * Captures the binding snapshot before deletion for undo.
 */
export class DeleteEdgeCommand implements Command {
  readonly description = "Delete connection";
  private snapshot: BindingSnapshot | null = null;

  constructor(
    private readonly spec: ComponentSpec,
    private readonly edgeId: string,
  ) {}

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureBindingSnapshot(this.spec, this.edgeId);
    if (!this.snapshot) return false;

    return deleteEdge(this.spec, this.edgeId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    return connectNodes(this.spec, {
      sourceNodeId: this.snapshot.sourceEntityId,
      sourceHandleId: `output_${this.snapshot.sourcePortName}`,
      targetNodeId: this.snapshot.targetEntityId,
      targetHandleId: `input_${this.snapshot.targetPortName}`,
    });
  }
}

// =============================================================================
// CONNECT COMMAND
// =============================================================================

/**
 * Find an entity by ID, with fallback lookup by name if the ID is not found.
 * This handles cases where entities were recreated with new IDs during undo/redo.
 */
function findEntityWithFallback(
  spec: ComponentSpec,
  entityId: string,
  entityName: string | undefined,
  nodeType: "input" | "output" | "task" | null,
): { entity: unknown; currentId: string } | null {
  if (nodeType === "input") {
    const input = spec.inputs.find((i) => i.$id === entityId);
    if (input) return { entity: input, currentId: entityId };

    // Fallback: look up by name if ID not found
    if (entityName) {
      const byName = spec.inputs.find((i) => i.name === entityName);
      if (byName) return { entity: byName, currentId: byName.$id };
    }
  } else if (nodeType === "output") {
    const output = spec.outputs.find((o) => o.$id === entityId);
    if (output) return { entity: output, currentId: entityId };

    if (entityName) {
      const byName = spec.outputs.find((o) => o.name === entityName);
      if (byName) return { entity: byName, currentId: byName.$id };
    }
  } else if (nodeType === "task") {
    const task = spec.tasks.find((t) => t.$id === entityId);
    if (task) return { entity: task, currentId: entityId };

    if (entityName) {
      const byName = spec.tasks.find((t) => t.name === entityName);
      if (byName) return { entity: byName, currentId: byName.$id };
    }
  }

  return null;
}

/**
 * Command to connect two nodes.
 *
 * Stores entity names alongside IDs to handle cases where entities are
 * recreated with new IDs during undo/redo cycles.
 */
export class ConnectNodesCommand implements Command {
  readonly description = "Connect nodes";
  private bindingSnapshot: BindingSnapshot | null = null;
  /** Source entity name for fallback lookup during redo */
  private sourceEntityName: string | undefined;
  /** Target entity name for fallback lookup during redo */
  private targetEntityName: string | undefined;

  constructor(
    private readonly spec: ComponentSpec,
    private connection: ConnectionInfo,
  ) {}

  execute(): boolean {
    const sourceType = getNodeTypeFromId(this.connection.sourceNodeId);
    const targetType = getNodeTypeFromId(this.connection.targetNodeId);

    // Try to find source entity, with fallback by name
    const sourceResult = findEntityWithFallback(
      this.spec,
      this.connection.sourceNodeId,
      this.sourceEntityName,
      sourceType,
    );

    // Try to find target entity, with fallback by name
    const targetResult = findEntityWithFallback(
      this.spec,
      this.connection.targetNodeId,
      this.targetEntityName,
      targetType,
    );

    // If either entity was found by fallback (different ID), update the connection
    if (
      sourceResult &&
      sourceResult.currentId !== this.connection.sourceNodeId
    ) {
      this.connection = {
        ...this.connection,
        sourceNodeId: sourceResult.currentId,
      };
    }
    if (
      targetResult &&
      targetResult.currentId !== this.connection.targetNodeId
    ) {
      this.connection = {
        ...this.connection,
        targetNodeId: targetResult.currentId,
      };
    }

    // Validate entities exist
    if (!sourceResult) {
      console.error(
        `ConnectNodesCommand: Source entity not found.`,
        `ID: ${this.connection.sourceNodeId}`,
        `Name: ${this.sourceEntityName ?? "(not captured)"}`,
        `Type: ${sourceType}`,
      );
      return false;
    }
    if (!targetResult) {
      console.error(
        `ConnectNodesCommand: Target entity not found.`,
        `ID: ${this.connection.targetNodeId}`,
        `Name: ${this.targetEntityName ?? "(not captured)"}`,
        `Type: ${targetType}`,
      );
      return false;
    }

    // Store entity names on first execution for fallback during redo
    if (!this.sourceEntityName) {
      this.sourceEntityName = this.getEntityName(
        sourceType,
        sourceResult.currentId,
      );
    }
    if (!this.targetEntityName) {
      this.targetEntityName = this.getEntityName(
        targetType,
        targetResult.currentId,
      );
    }

    const success = connectNodes(this.spec, this.connection);
    if (!success) return false;

    // Find the binding we just created by looking up the target port
    const targetInputName = this.connection.targetHandleId.replace(
      /^input_/,
      "",
    );
    const targetBindings = this.spec.bindings.all.filter(
      (b) =>
        b.targetEntityId === this.connection.targetNodeId &&
        b.targetPortName === targetInputName,
    );

    if (targetBindings.length > 0) {
      const binding = targetBindings[0];
      this.bindingSnapshot = {
        bindingId: binding.$id,
        sourceEntityId: binding.sourceEntityId,
        sourcePortName: binding.sourcePortName,
        targetEntityId: binding.targetEntityId,
        targetPortName: binding.targetPortName,
      };
    }

    return true;
  }

  private getEntityName(
    nodeType: "input" | "output" | "task" | null,
    entityId: string,
  ): string | undefined {
    if (nodeType === "input") {
      return this.spec.inputs.find((i) => i.$id === entityId)?.name;
    } else if (nodeType === "output") {
      return this.spec.outputs.find((o) => o.$id === entityId)?.name;
    } else if (nodeType === "task") {
      return this.spec.tasks.find((t) => t.$id === entityId)?.name;
    }
    return undefined;
  }

  undo(): boolean {
    if (!this.bindingSnapshot) return false;
    return deleteEdge(this.spec, `edge_${this.bindingSnapshot.bindingId}`);
  }
}

// =============================================================================
// SUBGRAPH COMMANDS
// =============================================================================

/**
 * Command to create a subgraph from selected tasks.
 * Note: Undo for subgraph creation is complex and may not fully restore state.
 */
export class CreateSubgraphCommand implements Command {
  readonly description: string;
  private subgraphTaskId: string | null = null;
  private originalTaskIds: string[] = [];

  constructor(
    private readonly spec: ComponentSpec,
    private readonly taskNames: string[],
    private readonly subgraphName: string,
    private readonly position: { x: number; y: number },
  ) {
    this.description = `Create subgraph "${subgraphName}"`;
  }

  execute(): boolean {
    // Capture original task IDs and external bindings BEFORE creating subgraph
    const selectedTasks = this.taskNames
      .map((name) => this.spec.tasks.find((t) => t.name === name))
      .filter(Boolean);

    if (selectedTasks.length === 0) return false;

    const selectedTaskIds = new Set(selectedTasks.map((t) => t!.$id));
    this.originalTaskIds = [...selectedTaskIds];

    // Execute the subgraph creation
    const subgraphTask = createSubgraph(
      this.spec,
      this.originalTaskIds,
      this.subgraphName,
      this.position,
    );

    if (!subgraphTask) return false;

    this.subgraphTaskId = subgraphTask.$id;
    return true;
  }

  undo(): boolean {
    if (!this.subgraphTaskId) return false;

    // Subgraph undo is complex because the tasks have been moved.
    // For now, we'll just delete the subgraph task.
    // Full undo would require extracting tasks back from the nested spec.
    deleteTask(this.spec, this.subgraphTaskId);

    console.warn(
      "CreateSubgraphCommand undo: Tasks were removed. Manual restoration may be needed.",
    );
    return true;
  }
}

// =============================================================================
// COMPOSITE COMMAND
// =============================================================================

/**
 * Composite command for batching multiple commands into a single undo/redo operation.
 * Useful for multi-select operations like moving multiple nodes.
 */
export class CompositeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly commands: Command[],
    description?: string,
  ) {
    this.description = description ?? `${commands.length} operations`;
  }

  execute(): boolean {
    // Execute all commands
    for (const cmd of this.commands) {
      if (!cmd.execute()) {
        // If any command fails, undo all previously executed commands
        const executedCommands = this.commands.slice(
          0,
          this.commands.indexOf(cmd),
        );
        for (const executed of executedCommands.reverse()) {
          executed.undo();
        }
        return false;
      }
    }
    return true;
  }

  undo(): boolean {
    // Undo in reverse order
    const reversed = [...this.commands].reverse();
    return reversed.every((cmd) => cmd.undo());
  }
}

// Re-export ConnectionInfo for use by callers
export type { ConnectionInfo };
