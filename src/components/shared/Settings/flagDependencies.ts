export interface FlagDependencyNode {
  enabled: boolean;
  dependsOn?: string;
}

/**
 * Walks a flag's `dependsOn` chain, satisfied only when every link is enabled.
 *
 * Fails closed: a chain pointing at a missing flag, or one that cycles,
 * resolves to false rather than granting a feature nothing can support.
 */
export function hasSatisfiedDependencies(
  key: string,
  lookup: (key: string) => FlagDependencyNode | undefined,
): boolean {
  const visited = new Set([key]);
  let dependencyKey = lookup(key)?.dependsOn;

  while (dependencyKey) {
    if (visited.has(dependencyKey)) return false;
    visited.add(dependencyKey);

    const dependency = lookup(dependencyKey);
    if (!dependency?.enabled) return false;

    dependencyKey = dependency.dependsOn;
  }

  return true;
}
