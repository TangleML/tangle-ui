import type {
  ComponentReference,
  ComponentSpec,
  TypeSpecType,
} from "@/models/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

export interface AiInputSpec {
  $id: string;
  name: string;
  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;
}

export interface AiOutputSpec {
  $id: string;
  name: string;
  type?: TypeSpecType;
  description?: string;
}

export interface AiComponentRef {
  name?: string;
  url?: string;
  spec?: {
    name?: string;
    inputs?: Array<{ name: string; type?: TypeSpecType }>;
    outputs?: Array<{ name: string; type?: TypeSpecType }>;
  };
}

export interface AiTaskSpec {
  $id: string;
  name: string;
  componentRef: AiComponentRef;
  arguments: Array<{ name: string; value?: unknown }>;
  isSubgraph?: boolean;
}

export interface AiBindingSpec {
  $id: string;
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

export interface AiSpec {
  name: string;
  description?: string;
  inputs: AiInputSpec[];
  outputs: AiOutputSpec[];
  tasks: AiTaskSpec[];
  bindings: AiBindingSpec[];
}

export function serializeSpecForAi(spec: ComponentSpec): AiSpec {
  return {
    name: spec.name,
    ...(spec.description && { description: spec.description }),
    inputs: spec.inputs.map((input) => ({
      $id: input.$id,
      name: input.name,
      ...(input.type && { type: input.type }),
      ...(input.description && { description: input.description }),
      ...(input.defaultValue && { default: input.defaultValue }),
      ...(input.optional !== undefined && { optional: input.optional }),
    })),
    outputs: spec.outputs.map((output) => ({
      $id: output.$id,
      name: output.name,
      ...(output.type && { type: output.type }),
      ...(output.description && { description: output.description }),
    })),
    tasks: spec.tasks.map((task) => ({
      $id: task.$id,
      name: task.name,
      componentRef: serializeComponentRef(task.componentRef),
      arguments: task.arguments.map((arg) => ({
        name: arg.name,
        ...(arg.value !== undefined && { value: arg.value }),
      })),
      ...(isGraphImplementation(task.componentRef.spec?.implementation) && {
        isSubgraph: true,
      }),
    })),
    bindings: spec.bindings.map((binding) => ({
      $id: binding.$id,
      sourceEntityId: binding.sourceEntityId,
      sourcePortName: binding.sourcePortName,
      targetEntityId: binding.targetEntityId,
      targetPortName: binding.targetPortName,
    })),
  };
}

function serializeComponentRef(ref: ComponentReference): AiComponentRef {
  const result: AiComponentRef = {};

  if (ref.name) result.name = ref.name;
  if (ref.url) result.url = ref.url;

  if (ref.spec) {
    result.spec = {
      ...(ref.spec.name && { name: ref.spec.name }),
      ...(ref.spec.inputs && {
        inputs: ref.spec.inputs.map((i) => ({
          name: i.name,
          ...(i.type && { type: i.type }),
        })),
      }),
      ...(ref.spec.outputs && {
        outputs: ref.spec.outputs.map((o) => ({
          name: o.name,
          ...(o.type && { type: o.type }),
        })),
      }),
    };
  }

  return result;
}
