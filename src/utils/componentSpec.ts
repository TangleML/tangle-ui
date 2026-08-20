import type {
  ContainerImplementationOutput,
  GraphImplementationOutput,
} from "@/api/types.gen";

import type { FLEX_NODES_ANNOTATION } from "./annotations";

export type TypeSpecType =
  | string
  | {
      [k: string]: TypeSpecType;
    };
interface InputOutputSpec {
  name: string;
  type?: TypeSpecType;
  description?: string;
  annotations?: {
    [k: string]: unknown;
  };
}
export interface InputSpec extends InputOutputSpec {
  name: string;
  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;
  value?: string;
  annotations?: {
    [k: string]: unknown;
  };
}
export interface OutputSpec extends InputOutputSpec {
  name: string;
  type?: TypeSpecType;
  description?: string;
  annotations?: {
    [k: string]: unknown;
  };
}
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by the input argument value.
 */
interface InputValuePlaceholder {
  inputValue: string;
}
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by a local file path pointing to a file containing the input argument value.
 */
interface InputPathPlaceholder {
  inputPath: string;
}
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by a local file path pointing to a file where the program should write its output data.
 */
interface OutputPathPlaceholder {
  outputPath: string;
}
export type StringOrPlaceholder =
  | string
  | InputValuePlaceholder
  | InputPathPlaceholder
  | OutputPathPlaceholder
  | ConcatPlaceholder
  | IfPlaceholder;
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by the concatenated values of its items.
 */
interface ConcatPlaceholder {
  concat: StringOrPlaceholder[];
}
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by a boolean value specifying whether the caller has passed an argument for the specified optional input.
 */
interface IsPresentPlaceholder {
  isPresent: string;
}
type IfConditionArgumentType =
  IsPresentPlaceholder | boolean | string | InputValuePlaceholder;
type ListOfStringsOrPlaceholders = StringOrPlaceholder[];
/**
 * Represents the command-line argument placeholder that will be replaced at run-time by either the
 * `then` or the `else` branch, depending on how `cond` evaluates.
 */
interface IfPlaceholder {
  if: {
    cond: IfConditionArgumentType;
    then: ListOfStringsOrPlaceholders;
    else?: ListOfStringsOrPlaceholders;
  };
}
interface ContainerSpec {
  image: string;
  // Not run through a shell. Omitting these falls back to the image's own
  // ENTRYPOINT and CMD respectively.
  command?: StringOrPlaceholder[];
  args?: StringOrPlaceholder[];
  env?: {
    [k: string]: StringOrPlaceholder;
  };
}
export interface ContainerImplementation {
  container: ContainerSpec;
}
export type ImplementationType = ContainerImplementation | GraphImplementation;
export interface MetadataSpec {
  annotations?: {
    [k: string]: unknown;
    canonical_location?: string;
    author?: string;
    python_original_code?: string;
    [FLEX_NODES_ANNOTATION]?: string;
  };
}
export interface ComponentSpec {
  name?: string;
  description?: string;
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
  implementation: ImplementationType;
  metadata?: MetadataSpec;
}
interface ComponentReferenceBase {
  name?: string;
  digest?: string;
  tag?: string;
  url?: string;
  spec?: ComponentSpec;
  // Unparsed component source, an alternative to `spec` (url -> data -> text -> spec).
  // Kept as text so the exact bytes behind the hash digest survive a round trip.
  // Not yet part of the standard.
  text?: string;
}

export interface ComponentReference extends ComponentReferenceBase {
  favorited?: boolean;
  published_by?: string;
  deprecated?: boolean;
  superseded_by?: string;
  owned?: boolean;
}

export type UnknownComponentReference = ComponentReference | null | undefined;

export type HydratedComponentReference = Omit<
  ComponentReference,
  "spec" | "text" | "digest" | "name"
> & {
  digest: string;
  name: string;
  spec: ComponentSpec;
  text: string;
};

type NotMaterializedComponentReference = Omit<
  ComponentReference,
  "spec" | "text"
> & {
  spec: never;
  text: never;
};

export function isNotMaterializedComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is NotMaterializedComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    !componentReference.spec &&
    !componentReference.text,
  );
}

export type DiscoverableComponentReference = Omit<
  ComponentReference,
  "digest"
> & {
  digest: string;
};

// todo: temp alias
export type ComponentReferenceWithDigest = DiscoverableComponentReference;

export function isDiscoverableComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is DiscoverableComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.digest !== undefined &&
    componentReference.digest.length > 0,
  );
}

export type LoadableComponentReference = Omit<ComponentReference, "url"> & {
  url: string;
};

export function isLoadableComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is LoadableComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.url !== undefined &&
    componentReference.url.length > 0,
  );
}

export type ContentfulComponentReference = Omit<
  ComponentReference,
  "spec" | "text"
> & {
  spec: ComponentSpec;
  text: string;
};

export function isContentfulComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is ContentfulComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.spec !== undefined &&
    componentReference.text !== undefined &&
    isValidComponentSpec(componentReference.spec) &&
    componentReference.text.length > 0,
  );
}

type TextOnlyComponentReference = Omit<ComponentReference, "spec" | "text"> & {
  spec: never;
  text: string;
};

export function isTextOnlyComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is TextOnlyComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    !componentReference.spec &&
    componentReference.text !== undefined &&
    componentReference.text.length > 0,
  );
}

type SpecOnlyComponentReference = Omit<ComponentReference, "spec"> & {
  spec: ComponentSpec;
  text: never;
};

export function isSpecOnlyComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is SpecOnlyComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.spec !== undefined &&
    isValidComponentSpec(componentReference.spec) &&
    (!componentReference.text || componentReference.text.length === 0),
  );
}

type PartialContentfulComponentReference =
  TextOnlyComponentReference | SpecOnlyComponentReference;

export function isPartialContentfulComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is PartialContentfulComponentReference {
  return Boolean(
    isTextOnlyComponentReference(componentReference) ||
    isSpecOnlyComponentReference(componentReference),
  );
}

export function isHydratedComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is HydratedComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.spec !== undefined &&
    componentReference.text !== undefined &&
    isValidComponentSpec(componentReference.spec) &&
    componentReference.text.length > 0 &&
    componentReference.digest !== undefined &&
    componentReference.digest.length > 0 &&
    componentReference.name !== undefined &&
    componentReference.name.length > 0,
  );
}

type InvalidComponentReference = Omit<ComponentReference, "spec" | "text"> & {
  url: never;
  digest: never;
  spec: never;
  text: never;
};

export function isInvalidComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is InvalidComponentReference {
  return Boolean(
    !componentReference ||
    typeof componentReference !== "object" ||
    (!isLoadableComponentReference(componentReference) &&
      !isDiscoverableComponentReference(componentReference) &&
      !componentReference.spec &&
      !componentReference.text),
  );
}

type DisplayableComponentReference = Omit<
  ComponentReference,
  "digest" | "name"
> & {
  digest: string;
  name: string;
};

export function isDisplayableComponentReference(
  componentReference: UnknownComponentReference,
): componentReference is DisplayableComponentReference {
  return Boolean(
    componentReference &&
    typeof componentReference === "object" &&
    componentReference.digest !== undefined &&
    componentReference.name !== undefined,
  );
}

/**
 * Represents the component argument value that comes from the graph component input.
 */
export interface GraphInputArgument {
  graphInput: {
    inputName: string;
    type?: TypeSpecType;
  };
}
/**
 * Represents the component argument value that comes from the output of a sibling task.
 */
export interface TaskOutputArgument {
  taskOutput: {
    taskId: string;
    outputName: string;
    type?: TypeSpecType;
  };
}
interface SecretReference {
  name: string;
}
export interface SecretArgument {
  secret: SecretReference;
}

/**
 * Represents dynamic data from system sources (e.g., multi-node execution context).
 * The key is the data identifier (e.g., "system/multi_node/node_index").
 */
type SystemDataArgument = {
  [key: string]: Record<string, unknown>;
};

export type DynamicDataValue = SecretArgument | SystemDataArgument;

export interface DynamicDataArgument {
  dynamicData: DynamicDataValue;
}

export type ArgumentType =
  string | GraphInputArgument | TaskOutputArgument | DynamicDataArgument;

interface TwoArgumentOperands {
  op1: ArgumentType;
  op2: ArgumentType;
}
interface TwoLogicalOperands {
  op1: PredicateType;
  op2: PredicateType;
}
type PredicateType =
  | {
      "==": TwoArgumentOperands;
    }
  | {
      "!=": TwoArgumentOperands;
    }
  | {
      ">": TwoArgumentOperands;
    }
  | {
      ">=": TwoArgumentOperands;
    }
  | {
      "<": TwoArgumentOperands;
    }
  | {
      "<=": TwoArgumentOperands;
    }
  | {
      and: TwoLogicalOperands;
    }
  | {
      or: TwoLogicalOperands;
    }
  | {
      not: PredicateType;
    };

interface RetryStrategySpec {
  maxRetries?: number;
}
interface CachingStrategySpec {
  // When a cached output is younger than this ISO 8601 duration, the task is skipped entirely.
  maxCacheStaleness?: string;
}

export interface ExecutionOptionsSpec {
  retryStrategy?: RetryStrategySpec;
  cachingStrategy?: CachingStrategySpec;
}
/**
 * A task is a configured component: a component supplied with arguments and other applied
 * configuration changes.
 */
export interface TaskSpec {
  componentRef: ComponentReference;
  arguments?: {
    [k: string]: ArgumentType;
  };
  isEnabled?: ArgumentType;
  executionOptions?: ExecutionOptionsSpec;
  annotations?: {
    [k: string]: unknown;
  };
}
export interface GraphSpec {
  tasks: {
    [k: string]: TaskSpec;
  };
  outputValues?: {
    [k: string]: TaskOutputArgument;
  };
}
export interface GraphImplementation {
  graph: GraphSpec;
}

export const isValidComponentSpec = (obj: any): obj is ComponentSpec =>
  obj !== null && typeof obj === "object" && "implementation" in obj;

export const isContainerImplementation = (
  implementation: ImplementationType,
): implementation is ContainerImplementation => "container" in implementation;

export const isGraphImplementation = (
  implementation: ImplementationType | null | undefined,
): implementation is GraphImplementation =>
  implementation !== null &&
  implementation !== undefined &&
  "graph" in implementation;

export const isGraphImplementationOutput = (
  implementation:
    | ContainerImplementationOutput
    | GraphImplementationOutput
    | null
    | undefined,
): implementation is GraphImplementationOutput =>
  implementation !== null &&
  implementation !== undefined &&
  "graph" in implementation &&
  implementation.graph !== null &&
  implementation.graph !== undefined;

/**
 * The template forms an argument reference takes in hand-written YAML, which the
 * deserializer converts into the structured `graphInput` / `taskOutput` shapes.
 */
export const GRAPH_INPUT_REGEX = /^\{\{inputs\.([^}]+)\}\}$/;
export const TASK_OUTPUT_REGEX = /^\{\{tasks\.([^.]+)\.outputs\.([^}]+)\}\}$/;

export const isTaskOutputArgument = (
  arg?: ArgumentType,
): arg is TaskOutputArgument =>
  typeof arg === "object" && arg !== null && "taskOutput" in arg;

export const isGraphInputArgument = (
  arg?: ArgumentType,
): arg is GraphInputArgument =>
  typeof arg === "object" && arg !== null && "graphInput" in arg;

export const isDynamicDataArgument = (
  arg?: ArgumentType,
): arg is DynamicDataArgument =>
  typeof arg === "object" && arg !== null && "dynamicData" in arg;

export const isSecretArgument = (
  arg?: ArgumentType,
): arg is DynamicDataArgument =>
  isDynamicDataArgument(arg) &&
  typeof arg.dynamicData === "object" &&
  arg.dynamicData !== null &&
  "secret" in arg.dynamicData;
