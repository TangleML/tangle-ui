import { registerRootStore } from "mobx-keystone";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

export function deserializeRunSpec(data: unknown): ComponentSpec {
  const generator = new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}
