import { indexManager as globalIndexManager } from "../indexes/indexManager";
import type { BaseEntity } from "./baseEntity";

type IndexableEntity = BaseEntity & { [key: string]: unknown };

function getIndexManager(entity: BaseEntity) {
  return entity.$ctx?.indexManager ?? globalIndexManager;
}

type ClassAccessorDecoratorTarget<This, Value> = {
  get: (this: This) => Value;
  set: (this: This, value: Value) => void;
};

type ClassAccessorDecoratorContext<This, Value> = {
  kind: "accessor";
  name: string | symbol;
  static: boolean;
  private: boolean;
  access: {
    get: (object: This) => Value;
    set: (object: This, value: Value) => void;
    has: (object: This) => boolean;
  };
  addInitializer: (initializer: () => void) => void;
};

type ClassAccessorDecoratorResult<This, Value> = {
  get?: (this: This) => Value;
  set?: (this: This, value: Value) => void;
  init?: (this: This, value: Value) => Value;
};

export function observable<This extends BaseEntity, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> {
  const fieldName = String(context.name);

  return {
    get(this: This): Value {
      return target.get.call(this);
    },
    set(this: This, newValue: Value): void {
      const oldValue = target.get.call(this);
      console.log("@observable set", fieldName, oldValue, "->", newValue);
      if (oldValue !== newValue) {
        target.set.call(this, newValue);
        (
          this as unknown as {
            emitChange: (f: string, n: unknown, o: unknown) => void;
          }
        ).emitChange(fieldName, newValue, oldValue);
      }
    },
  };
}

export function indexed<This extends BaseEntity, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> {
  const fieldName = String(context.name);
  const indexedEntities = new WeakSet<This>();

  return {
    get(this: This): Value {
      return target.get.call(this);
    },
    set(this: This, newValue: Value): void {
      const oldValue = target.get.call(this);
      target.set.call(this, newValue);

      const entity = this as unknown as IndexableEntity;
      const im = getIndexManager(this);
      if (indexedEntities.has(this)) {
        if (oldValue !== newValue) {
          im.reindex(entity, fieldName, oldValue);
          (
            this as unknown as {
              emitChange: (f: string, n: unknown, o: unknown) => void;
            }
          ).emitChange(fieldName, newValue, oldValue);
        }
      } else {
        im.index(entity, fieldName);
        indexedEntities.add(this);
      }
    },
  };
}

type PropertySetter<T> = (value: T) => void;
type PropertyGetter<T> = () => T;

export function createObservableProperty<T extends BaseEntity, V>(
  entity: T,
  field: string,
  initialValue: V,
): { get: PropertyGetter<V>; set: PropertySetter<V> } {
  let value = initialValue;
  return {
    get: () => value,
    set: (newValue: V) => {
      const oldValue = value;
      if (oldValue !== newValue) {
        value = newValue;
        entity["emitChange"](field, newValue, oldValue);
      }
    },
  };
}

export function createIndexedProperty<T extends BaseEntity, V>(
  entity: T,
  field: string,
  initialValue: V,
): { get: PropertyGetter<V>; set: PropertySetter<V> } {
  let value = initialValue;
  return {
    get: () => value,
    set: (newValue: V) => {
      const oldValue = value;
      if (oldValue !== newValue) {
        getIndexManager(entity).reindex(
          entity as unknown as IndexableEntity,
          field,
          oldValue,
        );
        value = newValue;
        entity["emitChange"](field, newValue, oldValue);
      }
    },
  };
}

export function defineObservable<T extends BaseEntity, V>(
  entity: T,
  propertyName: string,
  initialValue: V,
): void {
  const prop = createObservableProperty(entity, propertyName, initialValue);
  Object.defineProperty(entity, propertyName, {
    get: prop.get,
    set: prop.set,
    enumerable: true,
    configurable: true,
  });
}

export function defineIndexed<T extends BaseEntity, V>(
  entity: T,
  propertyName: string,
  initialValue: V,
): void {
  let value = initialValue;
  let isIndexed = false;
  const indexableEntity = entity as unknown as IndexableEntity;

  Object.defineProperty(entity, propertyName, {
    get: () => value,
    set: (newValue: V) => {
      const oldValue = value;
      value = newValue;
      const im = getIndexManager(entity);
      if (isIndexed) {
        if (oldValue !== newValue) {
          im.reindex(indexableEntity, propertyName, oldValue);
          entity["emitChange"](propertyName, newValue, oldValue);
        }
      } else {
        im.index(indexableEntity, propertyName);
        isIndexed = true;
      }
    },
    enumerable: true,
    configurable: true,
  });

  (entity as Record<string, unknown>)[propertyName] = initialValue;
}
