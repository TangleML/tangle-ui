import { useEffect, useRef } from "react";

import {
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

interface SharedStoreRegistrarProps {
  onReady?: (store: SharedUIStore) => void;
  onClosed?: () => void;
}

export function SharedStoreRegistrar({
  onReady,
  onClosed,
}: SharedStoreRegistrarProps) {
  const store = useSharedStores();
  const onReadyRef = useRef(onReady);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onReadyRef.current = onReady;
    onClosedRef.current = onClosed;
  });

  // Key registration off the stable store instance, not callback identity, so a
  // parent re-render with fresh callbacks doesn't re-fire ready/closed.
  useEffect(() => {
    onReadyRef.current?.(store);
    return () => onClosedRef.current?.();
  }, [store]);

  return null;
}
