/**
 * Navigation store for subgraph navigation.
 *
 * Tracks the navigation path through nested ComponentSpecs,
 * enabling breadcrumb navigation and unlimited nesting depth.
 */

import { proxy } from "valtio";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

/**
 * Entry in the navigation path representing a spec level.
 */
export interface NavigationEntry {
  /** $id of the ComponentSpec */
  specId: string;
  /** Display name for breadcrumbs */
  displayName: string;
}

/**
 * Store ComponentSpec entities OUTSIDE of Valtio proxy.
 * Valtio's proxy/snapshot mechanism breaks accessor decorators that use private fields.
 */
let _rootSpec: ComponentSpec | null = null;
let _nestedSpecs = new Map<string, ComponentSpec>();

interface NavigationStore {
  /** Trigger for rootSpec changes (increment to notify) */
  rootSpecVersion: number;
  /** Stack of navigation entries representing the path from root to current */
  navigationPath: NavigationEntry[];
  /** Trigger for nestedSpecs changes */
  nestedSpecsVersion: number;
  /** The root ComponentSpec (stored outside proxy, accessed via getter) */
  readonly rootSpec: ComponentSpec | null;
  /** Cache of deserialized nested specs (stored outside proxy, accessed via getter) */
  readonly nestedSpecs: Map<string, ComponentSpec>;
}

// Cast through unknown because rootSpec/nestedSpecs are added via Object.defineProperty
export const navigationStore = proxy<NavigationStore>({
  rootSpecVersion: 0,
  navigationPath: [],
  nestedSpecsVersion: 0,
} as unknown as NavigationStore);

/** Getters for the actual spec objects (outside of Valtio) */
export function getRootSpec(): ComponentSpec | null {
  return _rootSpec;
}

export function getNestedSpecs(): Map<string, ComponentSpec> {
  return _nestedSpecs;
}

/** For backward compatibility - access rootSpec directly */
Object.defineProperty(navigationStore, "rootSpec", {
  get: () => _rootSpec,
  enumerable: false,
});

/** For backward compatibility - access nestedSpecs directly */
Object.defineProperty(navigationStore, "nestedSpecs", {
  get: () => _nestedSpecs,
  enumerable: false,
});

/** ID generator for nested specs */
let nestedIdGen = new IncrementingIdGenerator();

/**
 * Check if spec JSON has a graph implementation.
 */
function isGraphSpecJson(specJson: ComponentSpecJson | undefined): boolean {
  if (!specJson?.implementation) return false;
  return "graph" in specJson.implementation;
}

/**
 * Initialize navigation with a root spec.
 * Resets navigation path to start at the root.
 */
export function initNavigation(rootSpec: ComponentSpec) {
  _rootSpec = rootSpec;
  navigationStore.rootSpecVersion++;
  navigationStore.navigationPath = [
    {
      specId: rootSpec.$id,
      displayName: rootSpec.name,
    },
  ];
  _nestedSpecs = new Map();
  navigationStore.nestedSpecsVersion++;
  nestedIdGen = new IncrementingIdGenerator();
}

/**
 * Clear navigation state.
 */
export function clearNavigation() {
  _rootSpec = null;
  navigationStore.rootSpecVersion++;
  navigationStore.navigationPath = [];
  _nestedSpecs = new Map();
  navigationStore.nestedSpecsVersion++;
}

/**
 * Traverse the navigation path to get the spec at a given depth.
 * Each entry after the root is a task name in the parent spec.
 * Uses the nestedSpecs cache for deserialized subgraphs.
 */
function getSpecAtDepth(
  rootSpec: ComponentSpec,
  path: NavigationEntry[],
  depth: number,
): ComponentSpec | undefined {
  if (depth === 0) {
    return rootSpec;
  }

  // Build the path key for cache lookup
  const pathKey = path
    .slice(1, depth + 1)
    .map((e) => e.displayName)
    .join("/");
  return _nestedSpecs.get(pathKey);
}

/**
 * Check if a task entity is a subgraph (has graph implementation).
 *
 * @param spec - The ComponentSpec containing the task
 * @param taskEntityId - The $id of the task to check
 */
export function isTaskSubgraph(
  spec: ComponentSpec,
  taskEntityId: string,
): boolean {
  const task = spec.tasks.find((t) => t.$id === taskEntityId);
  if (!task?.componentRef.spec) {
    return false;
  }

  return isGraphSpecJson(task.componentRef.spec as ComponentSpecJson);
}

/**
 * Deserialize a nested ComponentSpecJson into a ComponentSpec entity.
 * Caches the result in nestedSpecs.
 */
function deserializeNestedSpec(
  specJson: ComponentSpecJson,
  pathKey: string,
): ComponentSpec | undefined {
  try {
    const deserializer = new YamlDeserializer(nestedIdGen);
    const nestedSpec = deserializer.deserialize(specJson);
    _nestedSpecs.set(pathKey, nestedSpec);
    navigationStore.nestedSpecsVersion++;
    return nestedSpec;
  } catch (error) {
    console.error("[deserializeNestedSpec] Failed to deserialize:", error);
    return undefined;
  }
}

/**
 * Navigate into a subgraph task.
 * Pushes the nested spec onto the navigation stack and returns it.
 *
 * @param currentSpec - The current ComponentSpec containing the task
 * @param taskEntityId - The $id of the task entity to navigate into
 * @returns The subgraph spec if navigation succeeded, null otherwise
 */
export function navigateToSubgraph(
  currentSpec: ComponentSpec,
  taskEntityId: string,
): ComponentSpec | null {
  const { rootSpec, navigationPath } = navigationStore;

  console.log("[navigateToSubgraph] Starting with taskEntityId:", taskEntityId);
  console.log("[navigateToSubgraph] Current navigationPath:", navigationPath);

  if (!rootSpec) {
    console.log("[navigateToSubgraph] FAILED: no rootSpec");
    return null;
  }

  // Find the task entity
  const task = currentSpec.tasks.find((t) => t.$id === taskEntityId);
  console.log(
    "[navigateToSubgraph] Found task:",
    task?.name,
    "for ID:",
    taskEntityId,
  );

  if (!task) {
    console.log("[navigateToSubgraph] FAILED: task not found by ID");
    return null;
  }

  // Check if the task's component is a subgraph
  if (
    !task.componentRef.spec ||
    !isGraphSpecJson(task.componentRef.spec as ComponentSpecJson)
  ) {
    console.log("[navigateToSubgraph] FAILED: task is not a subgraph");
    return null;
  }

  // Build the path key for the nested spec
  const pathKey =
    navigationPath.length > 1
      ? navigationPath
          .slice(1)
          .map((e) => e.displayName)
          .join("/") +
        "/" +
        task.name
      : task.name;

  // Check if we already have the nested spec cached
  let nestedSpec = _nestedSpecs.get(pathKey);

  if (!nestedSpec) {
    // Deserialize the nested spec from the task's componentRef.spec
    nestedSpec = deserializeNestedSpec(
      task.componentRef.spec as ComponentSpecJson,
      pathKey,
    );
    if (!nestedSpec) {
      console.warn(
        `Could not deserialize nested ComponentSpec for task: ${task.name}`,
      );
      return null;
    }
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
  return nestedSpec;
}

/**
 * Navigate back one level in the hierarchy.
 * Pops the last entry from the navigation stack.
 *
 * @returns The spec at the new level if navigation succeeded, null if already at root
 */
export function navigateBack(): ComponentSpec | null {
  const { rootSpec, navigationPath } = navigationStore;

  // Can't go back from root
  if (!rootSpec || navigationPath.length <= 1) {
    return null;
  }

  navigationStore.navigationPath = navigationPath.slice(0, -1);

  // Return the spec at the new level
  const newDepth = navigationStore.navigationPath.length - 1;
  return (
    getSpecAtDepth(rootSpec, navigationStore.navigationPath, newDepth) ?? null
  );
}

/**
 * Navigate to a specific level in the navigation path.
 * Useful for breadcrumb navigation where users can jump to any ancestor.
 *
 * @param index - The index in the navigation path (0 = root)
 * @returns The spec at that level if navigation succeeded, null if index is invalid
 */
export function navigateToLevel(index: number): ComponentSpec | null {
  const { rootSpec, navigationPath } = navigationStore;

  if (!rootSpec || index < 0 || index >= navigationPath.length) {
    return null;
  }

  // Truncate the path to the specified level
  navigationStore.navigationPath = navigationPath.slice(0, index + 1);

  // Return the spec at that level
  return (
    getSpecAtDepth(rootSpec, navigationStore.navigationPath, index) ?? null
  );
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
 * @returns The spec at the target path if navigation succeeded, null if path is invalid
 */
export function navigateToPath(pathNames: string[]): ComponentSpec | null {
  const { rootSpec } = navigationStore;

  console.log("[navigateToPath] Starting with pathNames:", pathNames);
  console.log("[navigateToPath] rootSpec.name:", rootSpec?.name);

  if (!rootSpec || pathNames.length === 0) {
    console.log("[navigateToPath] FAILED: no rootSpec or empty path");
    return null;
  }

  // First name should match the root spec
  if (pathNames[0] !== rootSpec.name) {
    console.log("[navigateToPath] FAILED: path[0] doesn't match rootSpec.name");
    console.log("[navigateToPath] pathNames[0]:", JSON.stringify(pathNames[0]));
    console.log(
      "[navigateToPath] rootSpec.name:",
      JSON.stringify(rootSpec.name),
    );
    return null;
  }

  // Build the navigation path by traversing from root
  const newPath: NavigationEntry[] = [
    {
      specId: rootSpec.$id,
      displayName: rootSpec.name,
    },
  ];

  let currentSpec: ComponentSpec = rootSpec;

  // Navigate through each subsequent name in the path
  for (let i = 1; i < pathNames.length; i++) {
    const taskName = pathNames[i];
    console.log(
      "[navigateToPath] Looking for nested spec:",
      taskName,
      "in",
      currentSpec.name,
    );

    // Find the task with this name
    const task = currentSpec.tasks.find((t) => t.name === taskName);
    if (!task?.componentRef.spec) {
      console.warn(
        `[navigateToPath] Could not find task with subgraph for: ${taskName}`,
      );
      console.log(
        "[navigateToPath] Available tasks:",
        currentSpec.tasks.all.map((t) => t.name),
      );
      return null;
    }

    // Build the path key for this level
    const pathKey = pathNames.slice(1, i + 1).join("/");

    // Check if we have the nested spec cached, if not deserialize it
    let nestedSpec = _nestedSpecs.get(pathKey);
    if (!nestedSpec) {
      nestedSpec = deserializeNestedSpec(
        task.componentRef.spec as ComponentSpecJson,
        pathKey,
      );
      if (!nestedSpec) {
        console.warn(
          `[navigateToPath] Could not deserialize nested spec for: ${taskName}`,
        );
        return null;
      }
    }

    newPath.push({
      specId: nestedSpec.$id,
      displayName: taskName,
    });

    currentSpec = nestedSpec;
  }

  console.log(
    "[navigateToPath] SUCCESS: setting path to",
    newPath.map((e) => e.displayName),
  );
  navigationStore.navigationPath = newPath;
  return currentSpec;
}
