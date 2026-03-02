import { useCallback, useRef, useSyncExternalStore } from "react";

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
  const snapshotRef = useRef<readonly T[]>(EMPTY_ARRAY);
  const subscribeToChildren = options?.subscribeToChildren ?? false;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!array) return () => {};

      const updateSnapshot = (_event: ChangeDetail) => {
        console.log("useObservableArray updateSnapshot", array.all);
        snapshotRef.current = [...array.all];
        onStoreChange();
      };

      snapshotRef.current = [...array.all];

      const pattern = subscribeToChildren ? "changed.*" : "changed.self.*";
      const unsub = array.subscribe(pattern, updateSnapshot);

      return () => unsub();
    },
    [array, subscribeToChildren],
  );

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot);
}
