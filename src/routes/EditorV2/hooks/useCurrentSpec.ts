/**
 * Hook to get the current ComponentSpecEntity based on navigation state.
 *
 * This hook provides reactivity when the navigation path changes,
 * ensuring components re-render when navigating into/out of subgraphs.
 */

import { useSnapshot } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";

import {
  getCurrentSpec,
  navigationStore,
} from "../store/navigationStore";

/**
 * Hook to get the current ComponentSpecEntity based on navigation state.
 *
 * Returns the spec corresponding to the current position in the navigation path.
 * Automatically updates when navigation changes.
 */
export function useCurrentSpec(): ComponentSpecEntity | null {
  // Subscribe to navigation store changes
  // Accessing navigationPath triggers re-renders when it changes
  const snapshot = useSnapshot(navigationStore);

  // Force dependency on navigation path length for reactivity
  void snapshot.navigationPath.length;

  // Get the current spec using the navigation traversal logic
  return getCurrentSpec();
}
