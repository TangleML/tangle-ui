import type { ComponentSpec } from "../entities/componentSpec";
import type { ComponentValidationIssue, ValidationIssue } from "./types";
import { validateSpec } from "./validateSpec";

const ROOT_PATH_ID = "root";

/**
 * Recursively collect validation issues across the entire pipeline,
 * including nested subgraphs. Each issue includes a `subgraphPath`
 * indicating its location in the hierarchy.
 */
export function collectValidationIssues(
  spec: ComponentSpec,
): ComponentValidationIssue[] {
  return collectRecursive(spec, {
    subgraphPath: [ROOT_PATH_ID],
    skipInputConnectionValidation: false,
    visitedSpecIds: new Set(),
  });
}

interface CollectionContext {
  subgraphPath: string[];
  skipInputConnectionValidation: boolean;
  visitedSpecIds: Set<string>;
}

function collectRecursive(
  spec: ComponentSpec,
  context: CollectionContext,
): ComponentValidationIssue[] {
  if (context.visitedSpecIds.has(spec.$id)) return [];
  context.visitedSpecIds.add(spec.$id);

  const { subgraphPath } = context;
  const issues = validateSpec(spec);

  const currentIssues = issues.map((issue, index) =>
    toComponentIssue(issue, subgraphPath, index, spec),
  );

  const nestedIssues = spec.tasks.flatMap((task) => {
    if (!task.subgraphSpec) return [];
    return collectRecursive(task.subgraphSpec, {
      subgraphPath: [...subgraphPath, task.name],
      skipInputConnectionValidation: true,
      visitedSpecIds: context.visitedSpecIds,
    });
  });

  return [...currentIssues, ...nestedIssues];
}

function toComponentIssue(
  issue: ValidationIssue,
  subgraphPath: string[],
  index: number,
  spec: ComponentSpec,
): ComponentValidationIssue {
  const targetKey = issue.entityId ?? "graph";

  let entityName: string | undefined;
  if (issue.entityId) {
    const task = spec.tasks.find((t) => t.$id === issue.entityId);
    const input = spec.inputs.find((i) => i.$id === issue.entityId);
    const output = spec.outputs.find((o) => o.$id === issue.entityId);
    entityName = task?.name ?? input?.name ?? output?.name;
  }

  return {
    ...issue,
    id: `${subgraphPath.join(">")}::${issue.type}::${targetKey}::${index}`,
    subgraphPath,
    entityName,
  };
}
