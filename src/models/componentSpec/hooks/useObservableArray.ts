import { useEffect, useState } from "react";

import type { ObservableArray } from "../reactive/observableArray";
import type { ChangeDetail } from "../reactive/observableNode";

const EMPTY_ARRAY: readonly never[] = [];

export interface UseObservableArrayOptions {
  subscribeToChildren?: boolean;
}

export function useObservableArray<T>(
  array: ObservableArray<T> | null | undefined,
  options?: UseObservableArrayOptions,
): readonly T[] {
  const subscribeToChildren = options?.subscribeToChildren ?? false;
  const [snapshot, setSnapshot] = useState<readonly T[]>(() =>
    array ? [...array.all] : EMPTY_ARRAY,
  );

  useEffect(() => {
    if (!array) {
      setSnapshot(EMPTY_ARRAY);
      return;
    }

    const updateSnapshot = () => {
      setSnapshot([...array.all]);
    };

    // Initial snapshot for this array instance.
    updateSnapshot();

    // Always react to direct collection changes (add/remove/set/clear).
    const unsubs: Array<() => void> = [
      array.subscribe("changed.self.*", updateSnapshot),
    ];

    if (subscribeToChildren) {
      // In this model children are attached to the parent entity (not to the array itself),
      // so child updates bubble through array.parent. Subscribe there as well.
      const parent = array.parent;
      if (parent) {
        unsubs.push(
          parent.subscribe("changed.*", (detail: ChangeDetail) => {
            const source = detail.source;
            if (source === array || array.all.includes(source as T)) {
              updateSnapshot();
            }
          }),
        );
      }
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [array, subscribeToChildren]);

  return snapshot;
}
