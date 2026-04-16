import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

// Wire format types -- canonical source is @/utils/componentSpec
export type {
  ArgumentType,
  ComponentReference,
  ExecutionOptionsSpec,
  GraphImplementation,
  GraphSpec,
  ImplementationType,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  PredicateType,
  TaskOutputArgument,
  TaskSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
export {
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";

export type ComponentSpecJson = ComponentSpec;

// Model-specific types (no utils equivalent)

export interface BindingEndpoint {
  entityId: string;
  portName: string;
}

export interface Annotation {
  key: string;
  value: unknown;
}

export interface Argument {
  name: string;
  value?: ArgumentType;
}
