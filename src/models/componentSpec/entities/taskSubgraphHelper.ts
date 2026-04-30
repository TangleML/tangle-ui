import { IncrementingIdGenerator } from "../factories/idGenerator";
import { YamlDeserializer } from "../serialization/yamlDeserializer";
import type { ComponentSpec } from "./componentSpec";
import type { ComponentSpecJson } from "./types";

/**
 * Fallback deserializer for the `setComponentRef` guard.
 * Uses a fresh id generator since primary entry points
 * (YamlDeserializer, createSubgraph) pass models directly.
 */
export function deserializeSubgraphSpec(
  specJson: ComponentSpecJson,
): ComponentSpec {
  const idGen = new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(idGen);
  return deserializer.deserialize(specJson);
}
