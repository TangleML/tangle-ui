import { subscribe } from "valtio";

import { BaseCollection, type Context } from "./context";
import type { InputEntity, InputsCollection } from "./inputs";
import type { OutputEntity, OutputsCollection } from "./outputs";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

/**
 * Source entity type for bindings.
 * Can be InputEntity (graph input) or TaskEntity (task output).
 * Note: TaskEntity is imported dynamically to avoid circular dependency.
 */
export type BindingSourceEntity = InputEntity | { $id: string; name: string };

/**
 * Target entity type for bindings.
 * Can be TaskEntity (task input) or OutputEntity (graph output).
 * Note: TaskEntity is imported dynamically to avoid circular dependency.
 */
export type BindingTargetEntity = OutputEntity | { $id: string; name: string };

/**
 * Context interface for BindingsCollection.
 * Provides access to collections needed for entity resolution.
 */
export interface BindingsContext extends Context {
  inputs: InputsCollection;
  outputs: OutputsCollection;
  tasks: { findById(id: string): { $id: string; name: string } | undefined };
}

/**
 * Minimal interface for collections that can be watched.
 * Only requires the entities record that Valtio can subscribe to.
 */
interface WatchableCollection {
  entities: Record<string, BaseEntity<any>>;
}

/**
 * PortReference identifies a binding endpoint by ID.
 * Used when creating bindings to specify source and target.
 */
export interface PortReference {
  entityId: string;
  portName: string;
}

/**
 * EntityPortReference identifies a binding endpoint using an entity object.
 * The entity must have an $id property.
 */
export interface EntityPortReference {
  entity: { $id: string };
  portName: string;
}

/**
 * Type guard to check if a port reference uses an entity object.
 */
function isEntityPortReference(
  ref: PortReference | EntityPortReference,
): ref is EntityPortReference {
  return "entity" in ref;
}

/**
 * Scalar interface for BindingEntity - represents the raw data shape.
 */
export interface BindingScalar {
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

/**
 * BindingEntity represents a data flow connection between two ports.
 *
 * Binding types:
 * - graphInput: ComponentSpec Input → Task Input
 * - taskOutput: Task Output → Task Input
 * - outputValue: Task Output → ComponentSpec Output
 *
 * The entity stores IDs internally for serialization, but provides
 * `source` and `target` getters that resolve to actual entity objects.
 */
export class BindingEntity
  implements BaseEntity<BindingScalar>, SerializableEntity
{
  readonly $indexed = ["sourceEntityId" as const, "targetEntityId" as const];

  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;

  constructor(
    readonly $id: string,
    private readonly getContext: () => BindingsContext,
    required: RequiredProperties<BindingScalar>,
  ) {
    this.sourceEntityId = required.sourceEntityId;
    this.sourcePortName = required.sourcePortName;
    this.targetEntityId = required.targetEntityId;
    this.targetPortName = required.targetPortName;
  }

  populate(scalar: BindingScalar) {
    this.sourceEntityId = scalar.sourceEntityId;
    this.sourcePortName = scalar.sourcePortName;
    this.targetEntityId = scalar.targetEntityId;
    this.targetPortName = scalar.targetPortName;
    return this;
  }

  /**
   * Resolves the source entity from the context.
   * Returns InputEntity for graphInput bindings, or TaskEntity for taskOutput/outputValue bindings.
   *
   * @throws Error if the source entity cannot be found (indicates data corruption)
   */
  get source(): BindingSourceEntity {
    const context = this.getContext();

    // Try inputs first (for graphInput bindings)
    const input = context.inputs.findById(this.sourceEntityId);
    if (input) return input;

    // Try tasks (for taskOutput and outputValue bindings)
    const task = context.tasks.findById(this.sourceEntityId);
    if (task) return task;

    throw new Error(
      `Binding source entity not found: ${this.sourceEntityId}. This indicates data corruption.`,
    );
  }

  /**
   * Resolves the target entity from the context.
   * Returns TaskEntity for graphInput/taskOutput bindings, or OutputEntity for outputValue bindings.
   *
   * @throws Error if the target entity cannot be found (indicates data corruption)
   */
  get target(): BindingTargetEntity {
    const context = this.getContext();

    // Try outputs first (for outputValue bindings)
    const output = context.outputs.findById(this.targetEntityId);
    if (output) return output;

    // Try tasks (for graphInput and taskOutput bindings)
    const task = context.tasks.findById(this.targetEntityId);
    if (task) return task;

    throw new Error(
      `Binding target entity not found: ${this.targetEntityId}. This indicates data corruption.`,
    );
  }

  /**
   * Determines the binding type based on resolved source and target entities.
   *
   * Uses the actual entity collections to determine the type, which is more
   * robust than string pattern matching on entity IDs.
   */
  get bindingType(): "graphInput" | "taskOutput" | "outputValue" {
    const context = this.getContext();

    // Check if source is a graph input
    const sourceIsInput = context.inputs.has(this.sourceEntityId);
    if (sourceIsInput) return "graphInput";

    // Check if target is a graph output
    const targetIsOutput = context.outputs.has(this.targetEntityId);
    if (targetIsOutput) return "outputValue";

    // Otherwise it's a task-to-task connection
    return "taskOutput";
  }

  toJson(): BindingScalar {
    return {
      sourceEntityId: this.sourceEntityId,
      sourcePortName: this.sourcePortName,
      targetEntityId: this.targetEntityId,
      targetPortName: this.targetPortName,
    };
  }
}

/**
 * BindingsCollection manages all data flow bindings in a graph.
 *
 * Features:
 * - Indexed by sourceEntityId and targetEntityId for fast lookups
 * - Reactive cleanup via Valtio subscriptions when entities are deleted
 * - Unified API for all binding types
 * - Entities provide `source` and `target` getters for resolved entity access
 */
export class BindingsCollection
  extends BaseCollection<BindingScalar, BindingEntity>
  implements SerializableEntity
{
  /** Subscriptions for watching other collections for entity deletions */
  private _watchSubscriptions: Array<() => void> = [];

  constructor(
    parent: Context,
    private readonly getContext: () => BindingsContext,
  ) {
    super("bindings", parent);
  }

  createEntity(spec: BindingScalar): BindingEntity {
    return new BindingEntity(this.generateId(), this.getContext, spec).populate(
      spec,
    );
  }

  /**
   * Create a binding between two ports.
   *
   * Accepts either PortReference (with entityId) or EntityPortReference (with entity object).
   * Using entities directly is preferred as it provides better type safety.
   *
   * @example
   * // Using entity objects (preferred)
   * bindings.bind(
   *   { entity: inputEntity, portName: inputEntity.name },
   *   { entity: taskEntity, portName: "input_data" }
   * );
   *
   * @example
   * // Using entity IDs (legacy)
   * bindings.bind(
   *   { entityId: input.$id, portName: input.name },
   *   { entityId: task.$id, portName: "input_data" }
   * );
   */
  bind(
    source: PortReference | EntityPortReference,
    target: PortReference | EntityPortReference,
  ): BindingEntity {
    const sourceEntityId = isEntityPortReference(source)
      ? source.entity.$id
      : source.entityId;
    const targetEntityId = isEntityPortReference(target)
      ? target.entity.$id
      : target.entityId;

    // Check if binding already exists
    const existing = this.findBySourceAndTarget(
      sourceEntityId,
      source.portName,
      targetEntityId,
      target.portName,
    );
    if (existing) {
      return existing;
    }

    return this.add({
      sourceEntityId,
      sourcePortName: source.portName,
      targetEntityId,
      targetPortName: target.portName,
    });
  }

  /**
   * Remove a binding by its ID.
   */
  unbind(bindingId: string): boolean {
    return this.removeById(bindingId);
  }

  /**
   * Remove binding(s) to a specific target port.
   * A target port can only have one incoming binding, but this handles edge cases.
   */
  unbindByTargetPort(entityId: string, portName: string): boolean {
    const bindings = this.findByIndex("targetEntityId", entityId).filter(
      (b) => b.targetPortName === portName,
    );

    let removed = false;
    for (const binding of bindings) {
      if (this.removeById(binding.$id)) {
        removed = true;
      }
    }
    return removed;
  }

  /**
   * Remove all bindings where the given entity is either source or target.
   */
  unbindByEntity(entityId: string): number {
    const asSource = this.findByIndex("sourceEntityId", entityId);
    const asTarget = this.findByIndex("targetEntityId", entityId);

    const toRemove = new Set([
      ...asSource.map((b) => b.$id),
      ...asTarget.map((b) => b.$id),
    ]);

    let count = 0;
    for (const bindingId of toRemove) {
      if (this.removeById(bindingId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Find a specific binding by source and target ports.
   */
  findBySourceAndTarget(
    sourceEntityId: string,
    sourcePortName: string,
    targetEntityId: string,
    targetPortName: string,
  ): BindingEntity | undefined {
    const candidates = this.findByIndex("sourceEntityId", sourceEntityId);
    return candidates.find(
      (b) =>
        b.sourcePortName === sourcePortName &&
        b.targetEntityId === targetEntityId &&
        b.targetPortName === targetPortName,
    );
  }

  /**
   * Find all bindings where the given entity is the source.
   */
  findBySource(entityId: string): BindingEntity[] {
    return this.findByIndex("sourceEntityId", entityId);
  }

  /**
   * Find all bindings where the given entity is the target.
   */
  findByTarget(entityId: string): BindingEntity[] {
    return this.findByIndex("targetEntityId", entityId);
  }

  /**
   * Watch a collection for entity deletions.
   * When an entity is deleted, automatically remove all bindings referencing it.
   *
   * @param collection - The collection to watch (inputs, outputs, tasks)
   * @param role - Whether entities from this collection are "source", "target", or "both"
   */
  watchCollection(
    collection: WatchableCollection,
    role: "source" | "target" | "both",
  ): void {
    const unsubscribe = subscribe(collection.entities, (ops) => {
      for (const op of ops) {
        // Valtio ops format: [operation, path, value?, prevValue?]
        // For delete: ["delete", [key], prevValue]
        if (op[0] === "delete" && Array.isArray(op[1]) && op[1].length === 1) {
          const deletedEntityId = op[1][0] as string;
          this.handleEntityDeleted(deletedEntityId, role);
        }
      }
    });

    this._watchSubscriptions.push(unsubscribe);
  }

  /**
   * Handle entity deletion by removing related bindings.
   */
  private handleEntityDeleted(
    entityId: string,
    role: "source" | "target" | "both",
  ): void {
    const toRemove: string[] = [];

    if (role === "source" || role === "both") {
      const asSource = this.findByIndex("sourceEntityId", entityId);
      toRemove.push(...asSource.map((b) => b.$id));
    }

    if (role === "target" || role === "both") {
      const asTarget = this.findByIndex("targetEntityId", entityId);
      toRemove.push(...asTarget.map((b) => b.$id));
    }

    // Remove bindings (deduplicated)
    for (const bindingId of new Set(toRemove)) {
      this.removeById(bindingId);
    }
  }

  /**
   * Cleanup watch subscriptions when the collection is disposed.
   */
  dispose(): void {
    for (const unsub of this._watchSubscriptions) {
      unsub();
    }
    this._watchSubscriptions = [];
  }

  toJson(): BindingScalar[] {
    return this.getAll().map((binding) => binding.toJson());
  }
}

