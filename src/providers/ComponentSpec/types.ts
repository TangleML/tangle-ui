/**
 * Centralized types for the ComponentSpec object model.
 *
 * This file contains all types, interfaces, and type utilities used across
 * the ComponentSpec module. Entity classes import from here.
 */

import type {
  ComponentReference,
  ComponentSpec,
  ExecutionOptionsSpec,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  PredicateType,
  TaskSpec,
  TypeSpecType,
} from "@/utils/componentSpec";

// =============================================================================
// BASE ENTITY TYPES
// =============================================================================

/**
 * Base type for all entities in the object model.
 * Entities have an identity ($id), indexed fields, and can be populated from scalars.
 */
export type BaseEntity<
  TScalar = {},
  TKey extends keyof TScalar = keyof TScalar,
> = {
  readonly $id: string;
  readonly $indexed: TKey[];

  populate(scalar: TScalar): BaseEntity<TScalar, TKey>;
} & {
  [K in TKey]: TScalar[K];
};

/**
 * Primitive scalar types that can be serialized.
 */
export type ScalarType = undefined | null | string | number | boolean;

/**
 * Interface for entities that can be serialized to JSON.
 */
export interface SerializableEntity {
  toJson(): object | ScalarType;
}

/**
 * Extracts the required keys from a type.
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Picks only the required properties from a type.
 */
export type RequiredProperties<T> = Pick<T, RequiredKeys<T>>;

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Entity identifier type.
 */
export type EntityId = string;

/**
 * Interface for ID generators.
 */
export interface IdGenerator {
  generateId(): EntityId;
}

/**
 * Base context interface for entity management.
 */
export interface Context {
  $name: string;
  generateId(): EntityId;
  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void;
  removeEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void;
}

/**
 * Context with a parent relationship.
 */
export interface NestedContext extends Context {
  readonly $parent: Context;
}

// =============================================================================
// SCALAR INTERFACES
// =============================================================================

/**
 * Scalar interface for AnnotationEntity.
 */
export interface AnnotationScalarInterface {
  key: string;
  value?: unknown;
}

/**
 * Scalar interface for InputEntity.
 */
export type InputScalarInterface = Pick<
  InputSpec,
  "name" | "type" | "description" | "default" | "optional"
> & {
  /** Internal value for runtime use. NOT part of the ComponentSpec schema. */
  value?: string;
};

/**
 * Extended input scalar with annotations.
 */
export interface InputScalarWithAnnotations extends InputScalarInterface {
  annotations?: Record<string, unknown>;
}

/**
 * Scalar interface for OutputEntity.
 */
export type OutputScalarInterface = Pick<
  OutputSpec,
  "name" | "type" | "description"
>;

/**
 * Extended output scalar with annotations.
 */
export interface OutputScalarWithAnnotations extends OutputScalarInterface {
  annotations?: Record<string, unknown>;
}

/**
 * Scalar interface for TaskEntity.
 */
export type TaskScalarInterface = Pick<
  TaskSpec,
  "isEnabled" | "executionOptions"
> & {
  name: string;
  componentRef: ComponentReference;
};

/**
 * Extended task scalar with annotations for population.
 */
export interface TaskPopulateInput extends TaskScalarInterface {
  annotations?: Record<string, unknown>;
}

/**
 * Scalar interface for ArgumentEntity.
 */
export interface ArgumentScalarInterface {
  name: string;
}

/**
 * Scalar value types for arguments.
 */
export type ArgumentScalarValue = string | number | boolean | null | undefined;

/**
 * Scalar interface for BindingEntity.
 */
export interface BindingScalar {
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

/**
 * Scalar interface for ComponentSpecEntity.
 */
export type ComponentSpecScalarInterface = Pick<
  ComponentSpec,
  "description"
> & {
  name: string;
  metadata?: MetadataSpec;
};

// =============================================================================
// PORT REFERENCE TYPES
// =============================================================================

/**
 * Port reference using entity ID.
 */
export interface PortReference {
  entityId: string;
  portName: string;
}

/**
 * Port reference using entity object.
 */
export interface EntityPortReference {
  entity: { $id: string };
  portName: string;
}

/**
 * Type guard to check if a port reference uses an entity object.
 */
export function isEntityPortReference(
  ref: PortReference | EntityPortReference,
): ref is EntityPortReference {
  return "entity" in ref;
}

// =============================================================================
// COLLECTION INTERFACES (for GraphContext)
// =============================================================================

// Forward type declarations - these will be the actual entity types
// Using import type to avoid circular runtime dependencies
import type { BindingEntity } from "./bindings";
import type { InputEntity } from "./inputs";
import type { OutputEntity } from "./outputs";
import type { TaskEntity } from "./tasks";

/**
 * Interface for InputsCollection in GraphContext.
 */
export interface InputsCollectionInterface {
  findById(id: EntityId): InputEntity | undefined;
  has(id: EntityId): boolean;
  getAll(): InputEntity[];
}

/**
 * Interface for OutputsCollection in GraphContext.
 */
export interface OutputsCollectionInterface {
  findById(id: EntityId): OutputEntity | undefined;
  has(id: EntityId): boolean;
  getAll(): OutputEntity[];
}

/**
 * Interface for TasksCollection in GraphContext.
 */
export interface TasksCollectionInterface {
  findById(id: EntityId): TaskEntity | undefined;
  has(id: EntityId): boolean;
  getAll(): TaskEntity[];
}

/**
 * Interface for BindingsCollection in GraphContext.
 */
export interface BindingsCollectionInterface {
  findByTarget(id: EntityId): BindingEntity[];
  findBySource(id: EntityId): BindingEntity[];
  getAll(): BindingEntity[];
}

// =============================================================================
// UNIFIED GRAPH CONTEXT
// =============================================================================

/**
 * Unified context for all entities in a graph implementation.
 *
 * This single context provides access to all collections needed by any entity.
 * Uses lazy getters in GraphImplementation to defer access until collections
 * are fully initialized.
 */
export interface GraphContext extends Context {
  inputs: InputsCollectionInterface;
  outputs: OutputsCollectionInterface;
  tasks: TasksCollectionInterface;
  bindings: BindingsCollectionInterface;
}

// =============================================================================
// ENTITY UNION TYPES (STRONG TYPING)
// =============================================================================

/**
 * Source entity type for bindings.
 * Can be InputEntity (graph input) or TaskEntity (task output).
 */
export type BindingSourceEntity = InputEntity | TaskEntity;

/**
 * Target entity type for bindings.
 * Can be TaskEntity (task input) or OutputEntity (graph output).
 */
export type BindingTargetEntity = TaskEntity | OutputEntity;

// =============================================================================
// WATCHABLE COLLECTION INTERFACE
// =============================================================================

/**
 * Minimal interface for collections that can be watched for entity deletions.
 */
export interface WatchableCollection {
  entities: Record<string, BaseEntity<any>>;
}

// =============================================================================
// RE-EXPORTS FROM COMPONENT SPEC SCHEMA
// =============================================================================

export type {
  ComponentReference,
  ExecutionOptionsSpec,
  PredicateType,
  TypeSpecType,
};
