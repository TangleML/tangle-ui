import type { Annotations } from "../annotations";
import { serializeAnnotationValue } from "../annotations";
import { JsonSerializer } from "../serialization/jsonSerializer";
import type { ComponentSpec } from "./componentSpec";
import type { Input } from "./input";
import type { Output } from "./output";
import type {
  ComponentSpecJson,
  InputSpec,
  MetadataSpec,
  OutputSpec,
} from "./types";

const serializer = new JsonSerializer();

const PROXY_KEYS = new Set([
  "name",
  "description",
  "inputs",
  "outputs",
  "implementation",
  "metadata",
]);

/**
 * Creates a lazy ES Proxy over a live ComponentSpec keystone model that
 * presents itself as a ComponentSpecJson. Properties are only read from
 * the model when accessed -- zero upfront serialization cost.
 *
 * Not suitable for full serialization (JSON.stringify / yaml.dump).
 * For that, use `serializeComponentSpec()` directly.
 */
export function createComponentSpecProxy(
  spec: ComponentSpec,
): ComponentSpecJson {
  return new Proxy({} as ComponentSpecJson, {
    get(_target, prop) {
      switch (prop) {
        case "name":
          return spec.name;
        case "description":
          return spec.description;
        case "inputs":
          return spec.inputs.map(inputModelToSpec);
        case "outputs":
          return spec.outputs.map(outputModelToSpec);
        case "implementation":
          return serializer.serialize(spec).implementation;
        case "metadata":
          return annotationsToMetadata(spec.annotations);
        default:
          return undefined;
      }
    },
    has(_target, prop) {
      return PROXY_KEYS.has(prop as string);
    },
  });
}

function inputModelToSpec(input: Input): InputSpec {
  return {
    name: input.name,
    type: input.type,
    description: input.description,
    default: input.defaultValue,
    optional: input.optional,
  };
}

function outputModelToSpec(output: Output): OutputSpec {
  return {
    name: output.name,
    type: output.type,
    description: output.description,
  };
}

function annotationsToMetadata(
  annotations: Annotations,
): MetadataSpec | undefined {
  if (annotations.items.length === 0) return undefined;
  const record: Record<string, unknown> = {};
  for (const a of annotations.items) {
    record[a.key] = serializeAnnotationValue(a.key, a.value);
  }
  return { annotations: record };
}
