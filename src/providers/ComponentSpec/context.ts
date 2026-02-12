import { proxy } from "valtio";

import type { BaseEntity } from "./types";

export type EntityId = string;

export interface IdGenerator {
  generateId(): EntityId;
}

export interface Context {
  $name: string;
  generateId(): EntityId;
  registerEntity<TEntity extends BaseEntity<any>>(entity: TEntity): void;
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
}

export class EntityIndex<TEntity extends BaseEntity<any>> {
  /**
   * Plain object for entity storage.
   * Entities are wrapped with proxy() when added to ensure Valtio reactivity.
   */
  readonly entities: Record<EntityId, TEntity> = {};
  private readonly indexByKey = new IndexByKey();

  getAll(): TEntity[] {
    return Object.values(this.entities);
  }

  has(id: EntityId): boolean {
    return id in this.entities;
  }

  add(entity: TEntity) {
    // Wrap entity in proxy before storing to ensure Valtio tracks mutations
    const proxiedEntity = proxy(entity) as TEntity;
    this.entities[proxiedEntity.$id] = proxiedEntity;
    this.indexByKey.add(proxiedEntity);
  }

  remove(entity: TEntity) {
    this.removeById(entity.$id);
  }

  removeById(id: EntityId) {
    const entity = this.entities[id];
    if (!entity) {
      return false;
    }

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
