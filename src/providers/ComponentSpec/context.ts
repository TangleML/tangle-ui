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
  private readonly fieldValueToEntityId: Map<
    string | number | symbol,
    Map<unknown, Set<EntityId>>
  > = new Map();

  add<TEntity extends BaseEntity<any>>(entity: TEntity) {
    for (const index of entity.$indexed) {
      const fieldValue = entity[index];
      if (!this.fieldValueToEntityId.has(index)) {
        this.fieldValueToEntityId.set(
          index,
          new Map([[fieldValue, new Set([entity.$id])]]),
        );
        continue;
      }

      const valueToEntityId = this.fieldValueToEntityId.get(index)!;

      if (!valueToEntityId.has(fieldValue)) {
        valueToEntityId.set(fieldValue, new Set([entity.$id]));
        continue;
      }

      valueToEntityId.get(fieldValue)!.add(entity.$id);
    }
  }

  remove<TEntity extends BaseEntity<any>>(entity: TEntity) {
    for (const index of entity.$indexed) {
      const valueToEntityId = this.fieldValueToEntityId.get(index);
      if (!valueToEntityId) {
        continue;
      }
      const entityIds = valueToEntityId.get(entity[index]);
      if (!entityIds) {
        continue;
      }
      entityIds.delete(entity.$id);
    }
  }

  findByIndex<TEntity extends BaseEntity<any>, TKey extends keyof TEntity>(
    searchTerm: TKey,
    value: TEntity[TKey],
  ): EntityId[] {
    const valueToEntityId = this.fieldValueToEntityId.get(searchTerm);
    if (!valueToEntityId) {
      return [];
    }

    const entityIds = valueToEntityId.get(value);
    if (!entityIds) {
      return [];
    }
    return Array.from(entityIds);
  }
}

export class EntityIndex<TEntity extends BaseEntity<any>> {
  private readonly entities: Map<EntityId, TEntity> = new Map();
  private readonly indexByKey = new IndexByKey();

  getAll(): TEntity[] {
    return Array.from(this.entities.values());
  }

  has(id: EntityId): boolean {
    return this.entities.has(id);
  }

  add(entity: TEntity) {
    this.entities.set(entity.$id, entity);
    this.indexByKey.add(entity);
  }

  remove(entity: TEntity) {
    this.removeById(entity.$id);
  }

  removeById(id: EntityId) {
    const entity = this.entities.get(id);
    if (!entity) {
      return false;
    }

    this.indexByKey.remove(entity);
    this.entities.delete(id);

    return true;
  }

  findById(id: EntityId): TEntity | undefined {
    return this.entities.get(id);
  }

  findByIndex<TKey extends keyof TEntity>(
    index: TKey,
    value: TEntity[TKey],
  ): TEntity[] {
    const ids = this.indexByKey.findByIndex(index, value);
    return ids.map((id) => this.entities.get(id)!);
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
