import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { YamlDeserializer } from "@/models/componentSpec/serialization/yamlDeserializer";
import type { ComponentSpec } from "@/utils/componentSpec";

export type PipelineValidity = "valid" | "invalid" | "unknown";

function everyTaskCarriesItsComponent(spec: ComponentSpec) {
  const implementation = spec.implementation;

  if (!("graph" in implementation)) {
    return true;
  }

  return Object.values(implementation.graph.tasks ?? {}).every((task) =>
    Boolean(task.componentRef?.spec),
  );
}

/**
 * The validator reads each task's embedded component spec and never fetches
 * one, so a task whose component was not saved alongside it reads as a
 * hydration failure — indistinguishable from a real error. A saved pipeline
 * always embeds them, so rather than fetch the components to find out, an
 * unembedded one is reported as unknown and shows no verdict at all.
 */
export function pipelineValidity(spec: ComponentSpec): PipelineValidity {
  if (!everyTaskCarriesItsComponent(spec)) {
    return "unknown";
  }

  const model = new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
    spec,
  );

  return model.isValid ? "valid" : "invalid";
}
