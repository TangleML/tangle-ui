export type TypeSpecType =
  | string
  | {
      [k: string]: TypeSpecType;
    };

export interface BindingEndpoint {
  entityId: string;
  portName: string;
}

export interface Annotation {
  key: string;
  value: unknown;
}

export interface GraphInputArgument {
  graphInput: {
    inputName: string;
    type?: TypeSpecType;
  };
}

export interface TaskOutputArgument {
  taskOutput: {
    taskId: string;
    outputName: string;
    type?: TypeSpecType;
  };
}

export type ArgumentType = string | GraphInputArgument | TaskOutputArgument;

export interface Argument {
  name: string;
  value?: ArgumentType;
}

interface TwoArgumentOperands {
  op1: ArgumentType;
  op2: ArgumentType;
}

interface TwoLogicalOperands {
  op1: PredicateType;
  op2: PredicateType;
}

export type PredicateType =
  | { "==": TwoArgumentOperands }
  | { "!=": TwoArgumentOperands }
  | { ">": TwoArgumentOperands }
  | { ">=": TwoArgumentOperands }
  | { "<": TwoArgumentOperands }
  | { "<=": TwoArgumentOperands }
  | { and: TwoLogicalOperands }
  | { or: TwoLogicalOperands }
  | { not: PredicateType };

export interface ComponentReference {
  name?: string;
  digest?: string;
  tag?: string;
  url?: string;
  spec?: ComponentSpecJson;
  text?: string;
  favorited?: boolean;
  published_by?: string;
  deprecated?: boolean;
  superseded_by?: string;
  owned?: boolean;
}

export interface ComponentSpecJson {
  name?: string;
  description?: string;
  inputs?: InputSpecJson[];
  outputs?: OutputSpecJson[];
  implementation: ImplementationType;
  metadata?: MetadataSpec;
}

export interface InputSpecJson {
  name: string;
  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;
  value?: string;
  annotations?: Record<string, unknown>;
}

export interface OutputSpecJson {
  name: string;
  type?: TypeSpecType;
  description?: string;
  annotations?: Record<string, unknown>;
}

export interface MetadataSpec {
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphSpec {
  tasks: Record<string, TaskSpecJson>;
  outputValues?: Record<string, TaskOutputArgument>;
}

export interface GraphImplementation {
  graph: GraphSpec;
}

export interface ContainerImplementation {
  container: {
    image: string;
    command?: unknown[];
    args?: unknown[];
    env?: Record<string, unknown>;
  };
}

export type ImplementationType = ContainerImplementation | GraphImplementation;

export interface TaskSpecJson {
  componentRef: ComponentReference;
  arguments?: Record<string, ArgumentType>;
  isEnabled?: PredicateType;
  executionOptions?: {
    retryStrategy?: { maxRetries?: number };
    cachingStrategy?: { maxCacheStaleness?: string };
  };
  annotations?: Record<string, unknown>;
}

export const isGraphImplementation = (
  implementation: ImplementationType,
): implementation is GraphImplementation => "graph" in implementation;

export const isTaskOutputArgument = (
  arg?: ArgumentType,
): arg is TaskOutputArgument =>
  typeof arg === "object" && arg !== null && "taskOutput" in arg;

export const isGraphInputArgument = (
  arg?: ArgumentType,
): arg is GraphInputArgument =>
  typeof arg === "object" && arg !== null && "graphInput" in arg;
