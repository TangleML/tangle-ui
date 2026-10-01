import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { YamlDeserializer } from "@/models/componentSpec/serialization/yamlDeserializer";
import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";

export type PipelineValidity = "valid" | "invalid" | "unknown";

function everyTaskCarriesItsComponent(spec: ComponentSpec) {
  const implementation = spec.implementation;

  if (!implementation || typeof implementation !== "object") {
    return false;
  }

  if (!isGraphImplementation(implementation)) {
    return true;
  }

  // Browser storage holds whatever yaml was written, so a `graph:` key with
  // nothing under it reaches here.
  const graph: unknown = implementation.graph;
  if (!graph || typeof graph !== "object") {
    return false;
  }

  return Object.values(implementation.graph.tasks ?? {}).every((task) =>
    Boolean(task.componentRef?.spec),
  );
}

/**
 * The validator reads embedded component specs and never fetches one, so a task
 * whose component was not saved alongside it reads as a real error. Rather than
 * fetch the components to find out, such a spec is reported as unknown and
 * shows no verdict — as is one too malformed to have an implementation at all,
 * since browser storage holds whatever yaml is there and refusing to judge it
 * beats failing the panel it is previewed in.
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
