/**
 * Navigation store for subgraph navigation.
 *
 * Tracks the navigation path through nested ComponentSpecEntities,
 * enabling breadcrumb navigation and unlimited nesting depth.
 */

import { proxy } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { isGraphImplementation } from "@/utils/componentSpec";

/**
 * Entry in the navigation path representing a spec level.
 */
export interface NavigationEntry {
  /** $id of the ComponentSpecEntity */
  specId: string;
  /** Display name for breadcrumbs */
  displayName: string;
}

interface NavigationStore {
  /** The root ComponentSpecEntity (top-level pipeline) */
  rootSpec: ComponentSpecEntity | null;
  /** Stack of navigation entries representing the path from root to current */
  navigationPath: NavigationEntry[];
}

export const navigationStore = proxy<NavigationStore>({
  rootSpec: null,
  navigationPath: [],
});

/**
 * Initialize navigation with a root spec.
 * Resets navigation path to start at the root.
 */
export function initNavigation(rootSpec: ComponentSpecEntity) {
  // The spec is already proxied from YamlLoader. Modern valtio (v1.6+)
  // automatically detects and handles already-proxied objects without
  // double-wrapping. We store directly without ref() to preserve reactivity.
  navigationStore.rootSpec = rootSpec;
  navigationStore.navigationPath = [
    {
      specId: rootSpec.$id,
      displayName: rootSpec.name,
    },
  ];
}

/**
 * Clear navigation state.
 */
export function clearNavigation() {
  navigationStore.rootSpec = null;
  navigationStore.navigationPath = [];
}

/**
 * Check if spec has a graph implementation.
 */
function hasGraphImplementation(
  spec: ComponentSpecEntity | null,
): spec is ComponentSpecEntity & { implementation: GraphImplementation } {
  return spec?.implementation instanceof GraphImplementation;
}

/**
 * Traverse the navigation path to get the spec at a given depth.
 * Each entry after the root is a task name in the parent spec.
 */
function getSpecAtDepth(
  rootSpec: ComponentSpecEntity,
  path: NavigationEntry[],
  depth: number,
): ComponentSpecEntity | undefined {
  if (depth === 0) {
    return rootSpec;
  }

  // Traverse from root through each level
  let currentSpec: ComponentSpecEntity | undefined = rootSpec;
  for (let i = 1; i <= depth && currentSpec; i++) {
    const entry = path[i];
    // displayName is the task name, which is also the nested spec name
    currentSpec = currentSpec.findComponentSpecEntity(entry.displayName);
  }

  return currentSpec;
}

/**
 * Get the current spec based on the navigation path.
 * Returns the spec corresponding to the last entry in the path.
 */
export function getCurrentSpec(): ComponentSpecEntity | null {
  const { rootSpec, navigationPath } = navigationStore;

  if (!rootSpec || navigationPath.length === 0) {
    return null;
  }

  const currentDepth = navigationPath.length - 1;
  return getSpecAtDepth(rootSpec, navigationPath, currentDepth) ?? null;
}

/**
 * Check if a task entity is a subgraph (has graph implementation).
 */
export function isTaskSubgraph(taskEntityId: string): boolean {
  const currentSpec = getCurrentSpec();

  if (!currentSpec || !hasGraphImplementation(currentSpec)) {
    return false;
  }

  const task = currentSpec.implementation.tasks.findById(taskEntityId);
  if (!task?.componentRef.spec) {
    return false;
  }

  return isGraphImplementation(task.componentRef.spec.implementation);
}

/**
 * Navigate into a subgraph task.
 * Pushes the nested spec onto the navigation stack.
 *
 * @param taskEntityId - The $id of the task entity to navigate into
 * @returns true if navigation succeeded, false if the task is not a subgraph
 */
export function navigateToSubgraph(taskEntityId: string): boolean {
  const { rootSpec, navigationPath } = navigationStore;

  console.log("[navigateToSubgraph] Starting with taskEntityId:", taskEntityId);
  console.log("[navigateToSubgraph] Current navigationPath:", navigationPath);

  if (!rootSpec) {
    console.log("[navigateToSubgraph] FAILED: no rootSpec");
    return false;
  }

  const currentSpec = getCurrentSpec();
  console.log("[navigateToSubgraph] currentSpec:", currentSpec?.name);

  if (!currentSpec || !hasGraphImplementation(currentSpec)) {
    console.log("[navigateToSubgraph] FAILED: no currentSpec or no graph impl");
    return false;
  }

  // Find the task entity
  const task = currentSpec.implementation.tasks.findById(taskEntityId);
  console.log("[navigateToSubgraph] Found task:", task?.name, "for ID:", taskEntityId);

  // Debug: list all task IDs in current spec
  const allTasks = currentSpec.implementation.tasks.getAll();
  console.log("[navigateToSubgraph] All tasks in currentSpec:", allTasks.map(t => ({ name: t.name, id: t.$id })));

  if (!task) {
    console.log("[navigateToSubgraph] FAILED: task not found by ID");
    return false;
  }

  // Check if the task's component is a subgraph
  if (
    !task.componentRef.spec ||
    !isGraphImplementation(task.componentRef.spec.implementation)
  ) {
    console.log("[navigateToSubgraph] FAILED: task is not a subgraph");
    return false;
  }

  // Find the nested ComponentSpecEntity
  // YamlLoader creates nested specs with the task name as the entity name
  const nestedSpec = currentSpec.findComponentSpecEntity(task.name);
  if (!nestedSpec) {
    console.warn(
      `Could not find nested ComponentSpecEntity for task: ${task.name}`,
    );
    return false;
  }

  // Push onto navigation path
  navigationStore.navigationPath = [
    ...navigationPath,
    {
      specId: nestedSpec.$id,
      displayName: task.name,
    },
  ];

  console.log("[navigateToSubgraph] SUCCESS: navigated to", task.name);
  return true;
}

/**
 * Navigate back one level in the hierarchy.
 * Pops the last entry from the navigation stack.
 *
 * @returns true if navigation succeeded, false if already at root
 */
export function navigateBack(): boolean {
  const { navigationPath } = navigationStore;

  // Can't go back from root
  if (navigationPath.length <= 1) {
    return false;
  }

  navigationStore.navigationPath = navigationPath.slice(0, -1);
  return true;
}

/**
 * Navigate to a specific level in the navigation path.
 * Useful for breadcrumb navigation where users can jump to any ancestor.
 *
 * @param index - The index in the navigation path (0 = root)
 * @returns true if navigation succeeded, false if index is invalid
 */
export function navigateToLevel(index: number): boolean {
  const { navigationPath } = navigationStore;

  if (index < 0 || index >= navigationPath.length) {
    return false;
  }

  // Truncate the path to the specified level
  navigationStore.navigationPath = navigationPath.slice(0, index + 1);
  return true;
}

/**
 * Get the current navigation depth (0 = root level).
 */
export function getNavigationDepth(): number {
  return navigationStore.navigationPath.length - 1;
}

/**
 * Check if we can navigate back (not at root level).
 */
export function canNavigateBack(): boolean {
  return navigationStore.navigationPath.length > 1;
}

/**
 * Navigate directly to a specific path in the tree.
 * This allows navigating to any nested subgraph from anywhere.
 *
 * @param pathNames - Array of display names representing the path (e.g., ["RootPipeline", "SubgraphA", "SubgraphB"])
 * @returns true if navigation succeeded, false if path is invalid
 */
export function navigateToPath(pathNames: string[]): boolean {
  const { rootSpec } = navigationStore;

  console.log("[navigateToPath] Starting with pathNames:", pathNames);
  console.log("[navigateToPath] rootSpec.name:", rootSpec?.name);

  if (!rootSpec || pathNames.length === 0) {
    console.log("[navigateToPath] FAILED: no rootSpec or empty path");
    return false;
  }

  // First name should match the root spec
  if (pathNames[0] !== rootSpec.name) {
    console.log("[navigateToPath] FAILED: path[0] doesn't match rootSpec.name");
    console.log("[navigateToPath] pathNames[0]:", JSON.stringify(pathNames[0]));
    console.log("[navigateToPath] rootSpec.name:", JSON.stringify(rootSpec.name));
    return false;
  }

  // Build the navigation path by traversing from root
  const newPath: NavigationEntry[] = [
    {
      specId: rootSpec.$id,
      displayName: rootSpec.name,
    },
  ];

  let currentSpec: ComponentSpecEntity = rootSpec;

  // Navigate through each subsequent name in the path
  for (let i = 1; i < pathNames.length; i++) {
    const taskName = pathNames[i];
    console.log("[navigateToPath] Looking for nested spec:", taskName, "in", currentSpec.name);
    const nestedSpec = currentSpec.findComponentSpecEntity(taskName);

    if (!nestedSpec) {
      console.warn(`[navigateToPath] Could not find nested spec for: ${taskName}`);
      // List available nested specs
      const available = currentSpec.findAllComponentSpecEntities?.() ?? [];
      console.log("[navigateToPath] Available nested specs:", available.map((s: ComponentSpecEntity) => s.name));
      return false;
    }

    newPath.push({
      specId: nestedSpec.$id,
      displayName: taskName,
    });

    currentSpec = nestedSpec;
  }

  console.log("[navigateToPath] SUCCESS: setting path to", newPath.map(e => e.displayName));
  navigationStore.navigationPath = newPath;
  return true;
}

