import { ComponentSpec } from "../entities/componentSpec";
import type { IdGenerator } from "./idGenerator";

export function createComponentSpec(
  idGen: IdGenerator,
  name: string,
  description?: string,
): ComponentSpec {
  return new ComponentSpec({
    $id: idGen.next("spec"),
    name,
    description,
  });
}
