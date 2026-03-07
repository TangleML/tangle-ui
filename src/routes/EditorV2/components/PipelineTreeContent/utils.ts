import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  ValidationIssue,
} from "@/models/componentSpec";

export function isSubgraphTask(task: Task): boolean {
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  if (!componentSpec?.implementation) {
    return false;
  }
  return "graph" in componentSpec.implementation;
}

export function getEntityIssues(
  spec: ComponentSpec,
  entityId: string,
): ValidationIssue[] {
  return spec.issuesByEntityId.get(entityId) ?? [];
}

export function buildNavPathArray(
  entries: ReadonlyArray<{ readonly displayName: string }>,
): string[] {
  return entries.map((e) => e.displayName);
}

export function buildExpandedPaths(navPath: string[]): Set<string> {
  const paths = new Set<string>();
  for (let i = 0; i < navPath.length; i++) {
    paths.add(navPath.slice(0, i + 1).join("/"));
  }
  return paths;
}
