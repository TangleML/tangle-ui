/**
 * Command Pattern implementation for undo/redo functionality.
 *
 * Each Command encapsulates an action that can be executed and undone.
 * Commands are managed by the CommandManager which maintains undo/redo stacks.
 */

import type { XYPosition } from "@xyflow/react";

import type { ComponentReference } from "@/providers/ComponentSpec/types";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import type { TypeSpecType } from "@/utils/componentSpec";

import {
  addInput,
  addOutput,
  addTask,
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
import { getCurrentSpec } from "./navigationStore";

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

/** Argument value type (matches ArgumentScalarValue from entity model) */
type ArgumentValue = string | number | boolean | null | undefined;

/** Snapshot of an argument for undo operations */
export interface ArgumentSnapshot {
  name: string;
  value?: ArgumentValue;
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
  default?: string;
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
 * Extract position from entity annotations.
 */
function getPositionFromAnnotations(
  annotations: { key: string; value: string }[],
): XYPosition {
  const posAnnotation = annotations.find(
    (a) => a.key === EDITOR_POSITION_ANNOTATION,
  );
  if (posAnnotation) {
    try {
      return JSON.parse(posAnnotation.value) as XYPosition;
    } catch {
      // Fall through to default
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Capture a task snapshot for undo operations.
 */
export function captureTaskSnapshot(entityId: string): TaskSnapshot | null {
  const spec = getCurrentSpec();
  if (!spec?.implementation) return null;

  const task = spec.implementation.tasks?.findById(entityId);
  if (!task) return null;

  // Capture annotations (cast value to string as that's what the entity stores)
  const annotations: AnnotationSnapshot[] = task.annotations
    .getAll()
    .map((a) => ({ key: a.key, value: String(a.value) }));

  // Capture arguments
  const args: ArgumentSnapshot[] = task.arguments
    .getAll()
    .map((a) => ({ name: a.name, value: a.value }));

  // Capture connected bindings (as source or target)
  const allBindings = spec.implementation.bindings?.getAll() ?? [];
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
export function captureInputSnapshot(entityId: string): InputSnapshot | null {
  const spec = getCurrentSpec();
  if (!spec) return null;

  const input = spec.inputs.findById(entityId);
  if (!input) return null;

  // Capture annotations (cast value to string as that's what the entity stores)
  const annotations: AnnotationSnapshot[] = input.annotations
    .getAll()
    .map((a) => ({ key: a.key, value: String(a.value) }));

  // Capture connected bindings (as source)
  const allBindings = spec.implementation?.bindings?.getAll() ?? [];
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
    default: input.default,
    optional: input.optional,
    connectedBindings,
  };
}

/**
 * Capture an output snapshot for undo operations.
 */
export function captureOutputSnapshot(entityId: string): OutputSnapshot | null {
  const spec = getCurrentSpec();
  if (!spec) return null;

  const output = spec.outputs.findById(entityId);
  if (!output) return null;

  // Capture annotations (cast value to string as that's what the entity stores)
  const annotations: AnnotationSnapshot[] = output.annotations
    .getAll()
    .map((a) => ({ key: a.key, value: String(a.value) }));

  // Capture connected bindings (as target)
  const allBindings = spec.implementation?.bindings?.getAll() ?? [];
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
  edgeId: string,
): BindingSnapshot | null {
  const spec = getCurrentSpec();
  if (!spec?.implementation?.bindings) return null;

  // Extract binding ID from edge ID format: edge_{binding.$id}
  const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
  if (!bindingIdMatch) return null;

  const bindingId = bindingIdMatch[1];
  const binding = spec.implementation.bindings.findById(bindingId);
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
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename task to "${newName}"`;
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec?.implementation) return false;

    const task = spec.implementation.tasks?.findById(this.entityId);
    if (!task) return false;

    // Capture previous name before executing
    this.previousName = task.name;

    return renameTask(this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameTask(this.entityId, this.previousName);
  }
}

/**
 * Command to rename an input.
 */
export class RenameInputCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename input to "${newName}"`;
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec) return false;

    const input = spec.inputs.findById(this.entityId);
    if (!input) return false;

    // Capture previous name before executing
    this.previousName = input.name;

    return renameInput(this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameInput(this.entityId, this.previousName);
  }
}

/**
 * Command to rename an output.
 */
export class RenameOutputCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(
    private readonly entityId: string,
    private readonly newName: string,
  ) {
    this.description = `Rename output to "${newName}"`;
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec) return false;

    const output = spec.outputs.findById(this.entityId);
    if (!output) return false;

    // Capture previous name before executing
    this.previousName = output.name;

    return renameOutput(this.entityId, this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renameOutput(this.entityId, this.previousName);
  }
}

/**
 * Command to rename the pipeline.
 */
export class RenamePipelineCommand implements Command {
  readonly description: string;
  private previousName: string | null = null;

  constructor(private readonly newName: string) {
    this.description = `Rename pipeline to "${newName}"`;
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec) return false;

    // Capture previous name before executing
    this.previousName = spec.name;

    return renamePipeline(this.newName);
  }

  undo(): boolean {
    if (this.previousName === null) return false;
    return renamePipeline(this.previousName);
  }
}

/**
 * Command to update pipeline description.
 */
export class UpdateDescriptionCommand implements Command {
  readonly description: string;
  private previousDescription: string | undefined = undefined;
  private hadPreviousValue = false;

  constructor(private readonly newDescription: string | undefined) {
    this.description = newDescription
      ? "Update pipeline description"
      : "Clear pipeline description";
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec) return false;

    // Capture previous description before executing
    this.hadPreviousValue = true;
    this.previousDescription = spec.description;

    return updatePipelineDescription(this.newDescription);
  }

  undo(): boolean {
    if (!this.hadPreviousValue) return false;
    return updatePipelineDescription(this.previousDescription);
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
    private readonly entityId: string,
    private readonly newPosition: XYPosition,
  ) {}

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec) return false;

    // Find the entity and capture its current position
    const task = spec.implementation?.tasks?.findById(this.entityId);
    const input = spec.inputs.findById(this.entityId);
    const output = spec.outputs.findById(this.entityId);

    const entity = task ?? input ?? output;
    if (!entity) return false;

    // Get current position from annotations
    const posAnnotation = entity.annotations
      .getAll()
      .find((a) => a.key === EDITOR_POSITION_ANNOTATION);

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

    updateNodePosition(this.entityId, this.newPosition);
    return true;
  }

  undo(): boolean {
    if (!this.previousPosition) return false;
    updateNodePosition(this.entityId, this.previousPosition);
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
    private readonly componentRef: ComponentReference,
    private readonly position: XYPosition,
  ) {
    const name = componentRef.spec?.name ?? componentRef.name ?? "Task";
    this.description = `Add "${name}" task`;
  }

  execute(): boolean {
    const taskEntity = addTask(this.componentRef, this.position);
    if (!taskEntity) return false;

    this.createdEntityId = taskEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteTask(this.createdEntityId);
  }
}

/**
 * Command to add an input node.
 */
export class AddInputCommand implements Command {
  readonly description: string;
  private createdEntityId: string | null = null;

  constructor(
    private readonly position: XYPosition,
    private readonly name?: string,
  ) {
    this.description = name ? `Add "${name}" input` : "Add input";
  }

  execute(): boolean {
    const inputEntity = addInput(this.position, this.name);
    if (!inputEntity) return false;

    this.createdEntityId = inputEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteInput(this.createdEntityId);
  }
}

/**
 * Command to add an output node.
 */
export class AddOutputCommand implements Command {
  readonly description: string;
  private createdEntityId: string | null = null;

  constructor(
    private readonly position: XYPosition,
    private readonly name?: string,
  ) {
    this.description = name ? `Add "${name}" output` : "Add output";
  }

  execute(): boolean {
    const outputEntity = addOutput(this.position, this.name);
    if (!outputEntity) return false;

    this.createdEntityId = outputEntity.$id;
    return true;
  }

  undo(): boolean {
    if (!this.createdEntityId) return false;
    return deleteOutput(this.createdEntityId);
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

  constructor(private readonly entityId: string) {
    this.description = "Delete task";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureTaskSnapshot(this.entityId);
    if (!this.snapshot) return false;

    return deleteTask(this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    const spec = getCurrentSpec();
    if (!spec?.implementation) return false;

    // Re-add the task
    const taskEntity = addTask(this.snapshot.componentRef, this.snapshot.position);
    if (!taskEntity) return false;

    // Restore the original name if different
    if (taskEntity.name !== this.snapshot.name) {
      renameTask(taskEntity.$id, this.snapshot.name);
    }

    // Restore arguments
    for (const arg of this.snapshot.arguments) {
      const existingArg = taskEntity.arguments.findByIndex("name", arg.name)[0];
      if (existingArg) {
        existingArg.value = arg.value;
      } else {
        const newArg = taskEntity.arguments.add({ name: arg.name });
        newArg.value = arg.value;
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
        spec.inputs.findById(newSourceId) ??
        spec.implementation.tasks?.findById(newSourceId);
      const targetExists =
        spec.outputs.findById(newTargetId) ??
        spec.implementation.tasks?.findById(newTargetId);

      if (sourceExists && targetExists) {
        connectNodes({
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

  constructor(private readonly entityId: string) {
    this.description = "Delete input";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureInputSnapshot(this.entityId);
    if (!this.snapshot) return false;

    return deleteInput(this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    const spec = getCurrentSpec();
    if (!spec) return false;

    // Re-add the input
    const inputEntity = addInput(this.snapshot.position, this.snapshot.name);
    if (!inputEntity) return false;

    // Restore properties (convert null to undefined for entity model compatibility)
    if (this.snapshot.type !== undefined && this.snapshot.type !== null) {
      inputEntity.type = this.snapshot.type;
    }
    if (
      this.snapshot.description !== undefined &&
      this.snapshot.description !== null
    ) {
      inputEntity.description = this.snapshot.description;
    }
    if (this.snapshot.default !== undefined && this.snapshot.default !== null) {
      inputEntity.default = this.snapshot.default;
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
        spec.outputs.findById(binding.targetEntityId) ??
        spec.implementation?.tasks?.findById(binding.targetEntityId);

      if (targetExists) {
        connectNodes({
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

  constructor(private readonly entityId: string) {
    this.description = "Delete output";
  }

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureOutputSnapshot(this.entityId);
    if (!this.snapshot) return false;

    return deleteOutput(this.entityId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    const spec = getCurrentSpec();
    if (!spec) return false;

    // Re-add the output
    const outputEntity = addOutput(this.snapshot.position, this.snapshot.name);
    if (!outputEntity) return false;

    // Restore properties (convert null to undefined for entity model compatibility)
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
        spec.inputs.findById(binding.sourceEntityId) ??
        spec.implementation?.tasks?.findById(binding.sourceEntityId);

      if (sourceExists) {
        connectNodes({
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

  constructor(private readonly edgeId: string) {}

  execute(): boolean {
    // Capture snapshot before deletion
    this.snapshot = captureBindingSnapshot(this.edgeId);
    if (!this.snapshot) return false;

    return deleteEdge(this.edgeId);
  }

  undo(): boolean {
    if (!this.snapshot) return false;

    return connectNodes({
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

/** Connection info for ConnectNodesCommand */
export interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

/**
 * Find an entity by ID, with fallback lookup by name if the ID is not found.
 * This handles cases where entities were recreated with new IDs during undo/redo.
 *
 * @returns The entity and its current ID, or null if not found
 */
function findEntityWithFallback(
  spec: ReturnType<typeof getCurrentSpec>,
  entityId: string,
  entityName: string | undefined,
  nodeType: "input" | "output" | "task" | null,
): { entity: unknown; currentId: string } | null {
  if (!spec) return null;

  // Try direct ID lookup first
  if (nodeType === "input") {
    const input = spec.inputs.findById(entityId);
    if (input) return { entity: input, currentId: entityId };

    // Fallback: look up by name if ID not found
    if (entityName) {
      const byName = spec.inputs.findByIndex("name", entityName)[0];
      if (byName) return { entity: byName, currentId: byName.$id };
    }
  } else if (nodeType === "output") {
    const output = spec.outputs.findById(entityId);
    if (output) return { entity: output, currentId: entityId };

    if (entityName) {
      const byName = spec.outputs.findByIndex("name", entityName)[0];
      if (byName) return { entity: byName, currentId: byName.$id };
    }
  } else if (nodeType === "task" && spec.implementation?.tasks) {
    const task = spec.implementation.tasks.findById(entityId);
    if (task) return { entity: task, currentId: entityId };

    if (entityName) {
      const byName = spec.implementation.tasks.findByIndex("name", entityName)[0];
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

  constructor(private connection: ConnectionInfo) {}

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec?.implementation?.bindings) return false;

    const sourceType = getNodeTypeFromId(this.connection.sourceNodeId);
    const targetType = getNodeTypeFromId(this.connection.targetNodeId);

    // Try to find source entity, with fallback by name
    const sourceResult = findEntityWithFallback(
      spec,
      this.connection.sourceNodeId,
      this.sourceEntityName,
      sourceType,
    );

    // Try to find target entity, with fallback by name
    const targetResult = findEntityWithFallback(
      spec,
      this.connection.targetNodeId,
      this.targetEntityName,
      targetType,
    );

    // If either entity was found by fallback (different ID), update the connection
    if (sourceResult && sourceResult.currentId !== this.connection.sourceNodeId) {
      this.connection = {
        ...this.connection,
        sourceNodeId: sourceResult.currentId,
      };
    }
    if (targetResult && targetResult.currentId !== this.connection.targetNodeId) {
      this.connection = {
        ...this.connection,
        targetNodeId: targetResult.currentId,
      };
    }

    // Validate entities exist (with helpful error for debugging)
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
      this.sourceEntityName = this.getEntityName(spec, sourceType, sourceResult.currentId);
    }
    if (!this.targetEntityName) {
      this.targetEntityName = this.getEntityName(spec, targetType, targetResult.currentId);
    }

    const success = connectNodes(this.connection);
    if (!success) return false;

    // Find the binding we just created by looking up the target port
    // (a target port can only have one incoming binding)
    const targetInputName = this.connection.targetHandleId.replace(
      /^input_/,
      "",
    );
    const targetBindings = spec.implementation.bindings
      .findByIndex("targetEntityId", this.connection.targetNodeId)
      .filter((b) => b.targetPortName === targetInputName);

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
    spec: NonNullable<ReturnType<typeof getCurrentSpec>>,
    nodeType: "input" | "output" | "task" | null,
    entityId: string,
  ): string | undefined {
    if (nodeType === "input") {
      return spec.inputs.findById(entityId)?.name;
    } else if (nodeType === "output") {
      return spec.outputs.findById(entityId)?.name;
    } else if (nodeType === "task") {
      return spec.implementation?.tasks?.findById(entityId)?.name;
    }
    return undefined;
  }

  undo(): boolean {
    if (!this.bindingSnapshot) return false;
    return deleteEdge(`edge_${this.bindingSnapshot.bindingId}`);
  }
}

// =============================================================================
// SUBGRAPH COMMANDS
// =============================================================================

/** Snapshot of external binding data for subgraph undo */
interface ExternalBindingInfo {
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

/**
 * Command to create a subgraph from selected tasks.
 * This is a complex operation that:
 * 1. Creates a new ComponentSpec containing the selected tasks
 * 2. Creates a new task referencing the subgraph
 * 3. Moves tasks and internal bindings to the subgraph
 * 4. Remaps external connections
 */
export class CreateSubgraphCommand implements Command {
  readonly description: string;
  private subgraphTaskId: string | null = null;
  private originalTaskIds: string[] = [];
  private incomingBindings: ExternalBindingInfo[] = [];
  private outgoingBindings: ExternalBindingInfo[] = [];

  constructor(
    private readonly taskNames: string[],
    private readonly subgraphName: string,
    private readonly position: { x: number; y: number },
  ) {
    this.description = `Create subgraph "${subgraphName}"`;
  }

  execute(): boolean {
    const spec = getCurrentSpec();
    if (!spec?.implementation?.bindings || !spec.implementation.tasks) return false;

    const { tasks, bindings } = spec.implementation;

    // Capture original task IDs and external bindings BEFORE creating subgraph
    const selectedTasks = this.taskNames
      .map((name) => tasks.findByIndex("name", name)[0])
      .filter(Boolean);

    if (selectedTasks.length === 0) return false;

    const selectedTaskIds = new Set(selectedTasks.map((t) => t.$id));
    this.originalTaskIds = [...selectedTaskIds];

    // Capture external bindings
    const allBindings = bindings.getAll();

    // Incoming: from outside to selected tasks
    this.incomingBindings = allBindings
      .filter(
        (b) =>
          selectedTaskIds.has(b.targetEntityId) &&
          !selectedTaskIds.has(b.sourceEntityId),
      )
      .map((b) => ({
        sourceEntityId: b.sourceEntityId,
        sourcePortName: b.sourcePortName,
        targetEntityId: b.targetEntityId,
        targetPortName: b.targetPortName,
      }));

    // Outgoing: from selected tasks to outside
    this.outgoingBindings = allBindings
      .filter(
        (b) =>
          selectedTaskIds.has(b.sourceEntityId) &&
          !selectedTaskIds.has(b.targetEntityId),
      )
      .map((b) => ({
        sourceEntityId: b.sourceEntityId,
        sourcePortName: b.sourcePortName,
        targetEntityId: b.targetEntityId,
        targetPortName: b.targetPortName,
      }));

    // Execute the subgraph creation
    const subgraphTask = createSubgraph(
      this.taskNames,
      this.subgraphName,
      this.position,
    );

    if (!subgraphTask) return false;

    this.subgraphTaskId = subgraphTask.$id;
    return true;
  }

  undo(): boolean {
    if (!this.subgraphTaskId) return false;

    const spec = getCurrentSpec();
    if (!spec?.implementation) return false;

    // Find the subgraph task
    const subgraphTask = spec.implementation.tasks.findById(this.subgraphTaskId);
    if (!subgraphTask) return false;

    // Get the subgraph spec from the componentRef name
    // The subgraph spec entity should be registered in the parent spec
    const subgraphSpecName = subgraphTask.componentRef.spec?.name;
    const subgraphSpec = subgraphSpecName
      ? spec.findComponentSpecEntity(subgraphSpecName)
      : undefined;

    if (subgraphSpec?.implementation) {
      // Move all tasks from subgraph back to parent
      const subgraphTasks = subgraphSpec.implementation.tasks.getAll();
      for (const task of subgraphTasks) {
        const detached = subgraphSpec.implementation.tasks.detach(task);
        spec.implementation.tasks.attach(detached);
      }

      // Move all bindings from subgraph back to parent
      const subgraphBindings = subgraphSpec.implementation.bindings.getAll();
      // Filter to only internal bindings (between tasks, not to subgraph inputs/outputs)
      const internalBindings = subgraphBindings.filter(
        (b) =>
          this.originalTaskIds.includes(b.sourceEntityId) &&
          this.originalTaskIds.includes(b.targetEntityId),
      );
      for (const binding of internalBindings) {
        const detached = subgraphSpec.implementation.bindings.detach(binding);
        spec.implementation.bindings.attach(detached);
      }

      // Remove the subgraph spec entity from the parent's entity registry
      spec.removeEntity(subgraphSpec);
    }

    // Delete the subgraph task (this also cleans up its bindings in parent)
    deleteTask(this.subgraphTaskId);

    // Restore external bindings
    // Incoming bindings: from external sources to the restored tasks
    for (const binding of this.incomingBindings) {
      // Ensure the target task has the argument
      const targetTask = spec.implementation.tasks.findById(binding.targetEntityId);
      if (targetTask) {
        if (!targetTask.arguments.findByIndex("name", binding.targetPortName)[0]) {
          targetTask.arguments.add({ name: binding.targetPortName });
        }
      }

      connectNodes({
        sourceNodeId: binding.sourceEntityId,
        sourceHandleId: `output_${binding.sourcePortName}`,
        targetNodeId: binding.targetEntityId,
        targetHandleId: `input_${binding.targetPortName}`,
      });
    }

    // Outgoing bindings: from restored tasks to external targets
    for (const binding of this.outgoingBindings) {
      // If target is a task, ensure it has the argument
      const targetTask = spec.implementation.tasks.findById(binding.targetEntityId);
      if (targetTask) {
        if (!targetTask.arguments.findByIndex("name", binding.targetPortName)[0]) {
          targetTask.arguments.add({ name: binding.targetPortName });
        }
      }

      connectNodes({
        sourceNodeId: binding.sourceEntityId,
        sourceHandleId: `output_${binding.sourcePortName}`,
        targetNodeId: binding.targetEntityId,
        targetHandleId: `input_${binding.targetPortName}`,
      });
    }

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
    this.description =
      description ?? `${commands.length} operations`;
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

