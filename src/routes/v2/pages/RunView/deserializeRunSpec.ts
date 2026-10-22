import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

export function deserializeRunSpec(data: unknown): ComponentSpec {
  const generator = new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  return deserializer.deserialize(data);
}
