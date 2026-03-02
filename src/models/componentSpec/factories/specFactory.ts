import { ComponentSpec } from "../entities/componentSpec";
import type { IdGenerator } from "./idGenerator";

export function createComponentSpec(
  idGen: IdGenerator,
  name: string,
  description?: string,
): ComponentSpec {
  const spec = new ComponentSpec(idGen.next("spec"), name);
  if (description) {
    spec.description = description;
  }
  return spec;
}
