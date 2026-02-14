import { getVersion, proxy, subscribe } from "valtio";

import type { BaseEntity } from "./types";

export type EntityId = string;

export interface IdGenerator {
  generateId(): EntityId;
}

export interface Context {
  $name: string;
  generateId(): EntityId;
  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void;
  removeEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void;
}

export interface NestedContext extends Context {
  // todo: parent relationship is not yet implemented
  readonly $parent: Context;
}

export class AutoincrementIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix: string) {}

  generateId(): EntityId {
    return `${this.prefix}_${++this.counter}`;
  }
}

class IndexByKey {
  /**
   * Index structure using plain objects for valtio compatibility.
   * Structure: { [fieldName]: { [fieldValue]: { [entityId]: true } } }
   */
  private readonly fieldValueToEntityId: Record<
    string | number | symbol,
    Record<string, Record<EntityId, boolean>>
  > = {};

  add<TEntity extends BaseEntity<any>>(entity: TEntity) {
    for (const index of entity.$indexed) {
      const fieldValue = String(entity[index]);

      if (!this.fieldValueToEntityId[index]) {
        this.fieldValueToEntityId[index] = {};
      }

      const valueToEntityId = this.fieldValueToEntityId[index];

      if (!valueToEntityId[fieldValue]) {
        valueToEntityId[fieldValue] = {};
      }

      valueToEntityId[fieldValue][entity.$id] = true;
    }
  }

  remove<TEntity extends BaseEntity<any>>(entity: TEntity) {
    for (const index of entity.$indexed) {
      const valueToEntityId = this.fieldValueToEntityId[index];
      if (!valueToEntityId) {
        continue;
      }
      const fieldValue = String(entity[index]);
      const entityIds = valueToEntityId[fieldValue];
      if (!entityIds) {
        continue;
      }
      delete entityIds[entity.$id];
    }
  }

  findByIndex<TEntity extends BaseEntity<any>, TKey extends keyof TEntity>(
    searchTerm: TKey,
    value: TEntity[TKey],
  ): EntityId[] {
    const valueToEntityId = this.fieldValueToEntityId[searchTerm as string];
    if (!valueToEntityId) {
      return [];
    }

    const entityIds = valueToEntityId[String(value)];
    if (!entityIds) {
      return [];
    }
    return Object.keys(entityIds);
  }

  /**
   * Update the index for a single field when its value changes.
   * Removes the entity from the old value index and adds it to the new value index.
   */
  updateIndex<TEntity extends BaseEntity<any>>(
    entity: TEntity,
    field: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    // Remove from old value index
    const valueToEntityId = this.fieldValueToEntityId[field];
    if (valueToEntityId) {
      const entityIds = valueToEntityId[String(oldValue)];
      if (entityIds) {
        delete entityIds[entity.$id];
      }
    }

    // Add to new value index
    if (!this.fieldValueToEntityId[field]) {
      this.fieldValueToEntityId[field] = {};
    }
    if (!this.fieldValueToEntityId[field][String(newValue)]) {
      this.fieldValueToEntityId[field][String(newValue)] = {};
    }
    this.fieldValueToEntityId[field][String(newValue)][entity.$id] = true;
  }
}

export class EntityIndex<TEntity extends BaseEntity<any>> {
  /**
   * Plain object for entity storage.
   * Entities are wrapped with proxy() when added to ensure Valtio reactivity.
   */
  readonly entities: Record<EntityId, TEntity> = {};
  private readonly indexByKey = new IndexByKey();

  /**
   * Track subscriptions for each entity to enable auto-reindexing.
   * Maps entity $id to unsubscribe function.
   */
  private readonly subscriptions = new Map<EntityId, () => void>();

  /**
   * Track current values of indexed fields for each entity.
   * Used to detect changes and update indexes automatically.
   */
  private readonly indexedFieldValues = new Map<
    EntityId,
    Record<string, unknown>
  >();

  getAll(): TEntity[] {
    return Object.values(this.entities);
  }

  has(id: EntityId): boolean {
    return id in this.entities;
  }

  add(entity: TEntity) {
    if (this.has(entity.$id)) {
      return;
    }

    // Wrap entity in proxy before storing to ensure Valtio tracks mutations
    const proxiedEntity = getVersion(entity) !== undefined ? entity : proxy(entity) as TEntity;
    this.entities[proxiedEntity.$id] = proxiedEntity;
    this.indexByKey.add(proxiedEntity);

    // Set up auto-reindexing via subscription
    this.trackIndexedFields(proxiedEntity);
  }

  remove(entity: TEntity) {
    this.removeById(entity.$id);
  }

  removeById(id: EntityId) {
    const entity = this.entities[id];
    if (!entity) {
      return false;
    }

    // Clean up subscription
    const unsubscribe = this.subscriptions.get(id);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(id);
    }
    this.indexedFieldValues.delete(id);

    this.indexByKey.remove(entity);
    delete this.entities[id];

    return true;
  }

  findById(id: EntityId): TEntity | undefined {
    return this.entities[id];
  }

  findByIndex<TKey extends keyof TEntity>(
    index: TKey,
    value: TEntity[TKey],
  ): TEntity[] {
    const ids = this.indexByKey.findByIndex(index, value);
    return ids.map((id) => this.entities[id]).filter(Boolean) as TEntity[];
  }

  /**
   * Store initial indexed field values and subscribe to entity changes
   * for automatic reindexing.
   */
  private trackIndexedFields(entity: TEntity) {
    // Store current values of indexed fields
    const values: Record<string, unknown> = {};
    for (const field of entity.$indexed) {
      values[field as string] = entity[field];
    }
    this.indexedFieldValues.set(entity.$id, values);

    // Subscribe to entity changes for auto-reindexing
    const unsubscribe = subscribe(entity, () => {
      this.handleEntityChange(entity);
    });
    this.subscriptions.set(entity.$id, unsubscribe);
  }

  /**
   * Handle entity changes by checking indexed fields and updating the index
   * if any of them changed.
   */
  private handleEntityChange(entity: TEntity) {
    const oldValues = this.indexedFieldValues.get(entity.$id);
    if (!oldValues) return;

    for (const field of entity.$indexed) {
      const fieldKey = field as string;
      const oldValue = oldValues[fieldKey];
      const newValue = entity[field];

      if (oldValue !== newValue) {
        // Update index: remove old, add new
        this.indexByKey.updateIndex(entity, fieldKey, oldValue, newValue);
        // Update stored value
        oldValues[fieldKey] = newValue;
      }
    }
  }
}

export abstract class BaseCollection<
  TScalar,
  TEntity extends BaseEntity<TScalar>,
>
  extends EntityIndex<TEntity>
  implements NestedContext
{
  private readonly context: BaseNestedContext;

  constructor(contextName: string, parent: Context) {
    super();
    this.context = new BaseNestedContext(contextName, parent);
  }

  add(spec: TScalar) {
    const entity = this.createEntity(spec);
    this.context.registerEntity(entity);

    super.add(entity);

    // Return the proxied entity from the store
    return this.findById(entity.$id)!;
  }

  /**
   * Attach an existing entity to this collection.
   * Unlike `add`, this doesn't create a new entity via factory -
   * it takes an existing entity and makes it part of the collection,
   * respecting indexes and context.
   */
  attach(entity: TEntity): TEntity {
    this.context.registerEntity(entity);
    super.add(entity);

    // Return the proxied entity from the store
    return this.findById(entity.$id)!;
  }

  /**
   * Detach an entity from this collection.
   * Removes the entity from the collection, updates context and indexes,
   * and returns the detached entity.
   */
  detach(entity: TEntity): TEntity{
    // Remove from EntityIndex (handles subscription cleanup, index removal, etc.)
    super.remove(entity);
    // Remove from context
    this.context.removeEntity(entity);

    return entity;
  }

  abstract createEntity(spec: TScalar): TEntity;

  get $name(): string {
    return this.context.$name;
  }

  get $parent(): Context {
    return this.context.$parent;
  }

  generateId(): EntityId {
    return this.context.generateId();
  }

  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.context.registerEntity(entity);
  }

  removeEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.context.removeEntity(entity);
  }
}

export class BaseNestedContext implements NestedContext {
  private readonly idGenerator: IdGenerator;

  protected readonly entities: EntityIndex<BaseEntity<any>> = new EntityIndex();

  constructor(
    private readonly contextName: string,
    public readonly $parent: Context,
  ) {
    this.idGenerator = new AutoincrementIdGenerator(this.$name);
  }

  generateId(): EntityId {
    return this.idGenerator.generateId();
  }

  get $name(): string {
    return `${this.$parent.$name}.${this.contextName}`;
  }

  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.entities.add(entity);
  }

  removeEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.entities.remove(entity);
  }
}

export class RootContext implements Context {
  readonly $name = "root";
  private readonly entities: EntityIndex<BaseEntity<any>> = new EntityIndex();

  private readonly idGenerator: IdGenerator = new AutoincrementIdGenerator(
    "root",
  );

  generateId(): EntityId {
    return this.idGenerator.generateId();
  }

  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.entities.add(entity);
  }

  removeEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void {
    this.entities.remove(entity);
  }
}

/**
 *
 * const rootContext = new RootContext();
 *
 *
 *
 */
