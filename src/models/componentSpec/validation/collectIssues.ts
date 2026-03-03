import type { ComponentSpec } from "../entities/componentSpec";
import type { ComponentSpecJson } from "../entities/types";
import { isGraphImplementation } from "../entities/types";
import { IncrementingIdGenerator } from "../factories/idGenerator";
import { YamlDeserializer } from "../serialization/yamlDeserializer";
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
    toComponentIssue(issue, subgraphPath, index),
  );

  const nestedIssues = spec.tasks.flatMap((task) => {
    const nestedSpecJson = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    if (!nestedSpecJson?.implementation) return [];
    if (!isGraphImplementation(nestedSpecJson.implementation)) return [];

    const nestedSpec = deserializeNested(nestedSpecJson);
    if (!nestedSpec) return [];

    return collectRecursive(nestedSpec, {
      subgraphPath: [...subgraphPath, task.name],
      skipInputConnectionValidation: true,
      visitedSpecIds: context.visitedSpecIds,
    });
  });

  return [...currentIssues, ...nestedIssues];
}

function deserializeNested(
  specJson: ComponentSpecJson,
): ComponentSpec | undefined {
  try {
    const idGen = new IncrementingIdGenerator();
    const deserializer = new YamlDeserializer(idGen);
    return deserializer.deserialize(
      JSON.parse(JSON.stringify(specJson)) as ComponentSpecJson,
    );
  } catch {
    return undefined;
  }
}

function toComponentIssue(
  issue: ValidationIssue,
  subgraphPath: string[],
  index: number,
): ComponentValidationIssue {
  const targetKey = issue.entityId ?? "graph";
  return {
    ...issue,
    id: `${subgraphPath.join(">")}::${issue.type}::${targetKey}::${index}`,
    subgraphPath,
  };
}
