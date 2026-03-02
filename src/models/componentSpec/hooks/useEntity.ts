import { useEffect, useState } from "react";

import type { BaseEntity } from "../reactive/baseEntity";
import type { ObservableArray } from "../reactive/observableArray";

export interface UseEntityOptions {
  subscribeToChildren?: boolean;
}

/**
 * Snapshot type that extracts readable properties from an entity.
 * Excludes functions and ObservableArray properties (those should use useObservableArray).
 * Includes $source for access to the original entity for mutations.
 */
export type EntitySnapshot<T extends BaseEntity> = {
  readonly [K in keyof T as T[K] extends (...args: never[]) => unknown
    ? never
    : T[K] extends ObservableArray<unknown>
      ? never
      : K]: T[K];
} & {
  readonly $source: T;
};

function getAllPropertyNames(obj: object): string[] {
  const props = new Set<string>();
  let current: object | null = obj;

  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      props.add(name);
    }
    current = Object.getPrototypeOf(current);
  }

  return Array.from(props);
}

function createEntitySnapshot<T extends BaseEntity>(
  entity: T,
): EntitySnapshot<T> {
  // ES2022 auto-accessors create non-enumerable prototype-level getters.
  // We need to get all property names (including non-enumerable from prototype chain)
  // and read their values to create a proper snapshot.
  const snapshot: Record<string, unknown> = { $source: entity };

  for (const key of getAllPropertyNames(entity)) {
    // Skip internal/special properties and $source
    if (key === "$source" || key === "constructor") continue;

    try {
      const value = (entity as Record<string, unknown>)[key];
      // Skip functions and undefined values
      if (typeof value === "function" || value === undefined) continue;
      snapshot[key] = value;
    } catch {
      // Skip properties that throw on access
    }
  }

  return snapshot as EntitySnapshot<T>;
}

/**
 * Subscribe to an entity's changes and return a snapshot object.
 *
 * The snapshot is a new object reference on each change, making it compatible
 * with React Compiler's memoization. Use snapshot properties for reading in JSX,
 * and $source for mutations.
 *
 * @example
 * ```tsx
 * const task = useEntity(originalTask);
 * if (!task) return null;
 *
 * // Read from snapshot (triggers re-render on change)
 * return <div>{task.name}</div>;
 *
 * // Mutate via $source
 * task.$source.name = "New name";
 * ```
 */
export function useEntity<T extends BaseEntity>(
  entity: T | null | undefined,
  options?: UseEntityOptions,
): EntitySnapshot<T> | null {
  const subscribeToChildren = options?.subscribeToChildren ?? false;

  const [snapshot, setSnapshot] = useState<EntitySnapshot<T> | null>(() =>
    entity ? createEntitySnapshot(entity) : null,
  );

  useEffect(() => {
    if (!entity) {
      setSnapshot(null);
      return;
    }

    // Create initial snapshot for this entity
    setSnapshot(createEntitySnapshot(entity));

    const handleChange = () => {
      setSnapshot(createEntitySnapshot(entity));
    };

    const pattern = subscribeToChildren ? "changed.*" : "changed.self.*";
    const unsub = entity.subscribe(pattern, handleChange);

    return unsub;
  }, [entity, subscribeToChildren]);

  return snapshot;
}
