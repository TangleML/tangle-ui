import { componentSpecToText, componentSpecToYaml } from "@/utils/yaml";

import type { ComponentSpec } from "../entities/componentSpec";
import type { ComponentSpecJson } from "../entities/types";
import { JsonSerializer } from "./jsonSerializer";

const serializer = new JsonSerializer();

/** Serialize a ComponentSpec model to its JSON wire format. */
export function serializeComponentSpec(spec: ComponentSpec): ComponentSpecJson {
  return serializer.serialize(spec);
}

/** Serialize a ComponentSpec model to a YAML string. */
export function serializeComponentSpecToYaml(spec: ComponentSpec): string {
  return componentSpecToYaml(serializeComponentSpec(spec));
}

/** Serialize a ComponentSpec model to a display-friendly text string. */
export function serializeComponentSpecToText(spec: ComponentSpec): string {
  return componentSpecToText(serializeComponentSpec(spec));
}
