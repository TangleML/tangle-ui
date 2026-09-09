import type {
  ArgumentType,
  ComponentReference,
  ComponentSpec,
  ContainerImplementation,
  GraphSpec,
  ImplementationType,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import {
  isDynamicDataArgument,
  isGraphImplementation,
} from "@/utils/componentSpec";

const COMPONENT_SPEC_KEYS = new Set([
  "name",
  "description",
  "metadata",
  "inputs",
  "outputs",
  "implementation",
]);
const COMPONENT_REFERENCE_KEYS = new Set([
  "name",
  "digest",
  "tag",
  "url",
  "spec",
  "text",
]);
const METADATA_KEYS = new Set(["annotations", "labels"]);
const INPUT_KEYS = new Set([
  "name",
  "type",
  "description",
  "default",
  "optional",
  "annotations",
]);
const OUTPUT_KEYS = new Set(["name", "type", "description", "annotations"]);
const TASK_KEYS = new Set([
  "componentRef",
  "arguments",
  "isEnabled",
  "executionOptions",
  "annotations",
]);
const GRAPH_KEYS = new Set(["tasks", "outputValues"]);
const CONTAINER_KEYS = new Set(["image", "command", "args", "env"]);

/**
 * Reduces a pipeline to the fields that describe the pipeline itself, dropping
 * the per-viewer component-library state (`favorited`, `owned`, `published_by`,
 * `superseded_by`) that the in-memory model accumulates, so a saved document
 * does not carry one person's library into someone else's copy.
 */
export function toPortablePipelineSpec(spec: ComponentSpec): ComponentSpec {
  const picked = pickKeys(spec, COMPONENT_SPEC_KEYS);
  const result: ComponentSpec = {
    ...picked,
    implementation: pickImplementation(spec.implementation),
  };

  if (result.metadata) result.metadata = pickMetadata(result.metadata);
  if (result.inputs) result.inputs = result.inputs.map(pickInput);
  if (result.outputs) result.outputs = result.outputs.map(pickOutput);

  return result;
}

function pickImplementation(
  implementation: ImplementationType,
): ImplementationType {
  if (isGraphImplementation(implementation)) {
    return { graph: pickGraph(implementation.graph) };
  }
  return pickContainer(implementation);
}

function pickContainer(
  implementation: ContainerImplementation,
): ContainerImplementation {
  return {
    container: {
      ...pickKeys(implementation.container, CONTAINER_KEYS),
      image: implementation.container.image,
    },
  };
}

function pickGraph(graph: GraphSpec): GraphSpec {
  return {
    ...pickKeys(graph, GRAPH_KEYS),
    tasks: mapValues(graph.tasks, pickTask),
  };
}

function pickTask(task: TaskSpec): TaskSpec {
  const result: TaskSpec = {
    ...pickKeys(task, TASK_KEYS),
    componentRef: pickComponentReference(task.componentRef),
  };

  if (result.arguments) result.arguments = pickArguments(result.arguments);

  return result;
}

function pickComponentReference(
  componentRef: ComponentReference,
): ComponentReference {
  const result = pickKeys(componentRef, COMPONENT_REFERENCE_KEYS);
  if (result.spec) result.spec = toPortablePipelineSpec(result.spec);
  return result;
}

function pickArguments(
  args: Record<string, ArgumentType>,
): Record<string, ArgumentType> {
  const result: Record<string, ArgumentType> = {};

  for (const [name, argument] of Object.entries(args)) {
    if (isDynamicDataArgument(argument)) {
      // A dynamicData payload addresses secrets and execution-time context
      // whose shape this app does not model, so it is passed through verbatim:
      // filtering inside it would strip what a run needs and only fail at run
      // time. That is safe only while nothing else rides on the same object, so
      // an argument carrying a sibling key is dropped rather than half-copied.
      if (Object.keys(argument).length === 1) result[name] = argument;
      continue;
    }
    result[name] = argument;
  }

  return result;
}

function pickMetadata(metadata: MetadataSpec): MetadataSpec {
  return pickKeys(metadata, METADATA_KEYS);
}

function pickInput(input: InputSpec): InputSpec {
  return { ...pickKeys(input, INPUT_KEYS), name: input.name };
}

function pickOutput(output: OutputSpec): OutputSpec {
  return { ...pickKeys(output, OUTPUT_KEYS), name: output.name };
}

function mapValues<T>(
  source: Record<string, T>,
  transform: (value: T) => T,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = transform(value);
  }
  return result;
}

/**
 * Copies the allowed keys in the order the source declares them, so a document
 * that loses nothing also serialises byte-for-byte as it did before.
 */
function pickKeys<T extends object>(
  source: T,
  allowed: ReadonlySet<string>,
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) continue;
    const typedKey = key as keyof T;
    if (source[typedKey] === undefined) continue;
    result[typedKey] = source[typedKey];
  }

  return result;
}
