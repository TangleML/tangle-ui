/**
 * Hook to get the current ComponentSpecEntity based on navigation state.
 *
 * This hook provides reactivity when the navigation path changes,
 * ensuring components re-render when navigating into/out of subgraphs.
 * Also subscribes to spec changes to ensure deep reactivity.
 */

import { useEffect, useReducer } from "react";
import { subscribe, useSnapshot } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

import {
  getCurrentSpec,
  navigationStore,
} from "../store/navigationStore";

/**
 * Hook to get the current ComponentSpecEntity based on navigation state.
 *
 * Returns the spec corresponding to the current position in the navigation path.
 * Automatically updates when navigation changes or spec properties change.
 */
export function useCurrentSpec(): ComponentSpecEntity | null {
  // Subscribe to navigation store changes
  // Accessing navigationPath triggers re-renders when it changes
  const snapshot = useSnapshot(navigationStore);

  // Force dependency on navigation path length for reactivity
  void snapshot.navigationPath.length;

  // Get the current spec using the navigation traversal logic
  const spec = getCurrentSpec();

  // Subscribe to deep spec changes. The navigationStore uses ref() which
  // prevents valtio from tracking spec property changes. This subscription
  // ensures components re-render when spec properties change.
  const [, forceUpdate] = useReducer((c) => c + 1, 0);

  useEffect(() => {
    if (!spec) return;

    const unsubscribe = subscribe(spec, forceUpdate);
    return unsubscribe;
  }, [spec]);

  return spec;
}
