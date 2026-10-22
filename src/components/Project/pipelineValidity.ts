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

  // Imported YAML can contain a `graph:` key with nothing under it.
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
 * shows no verdict. A malformed implementation also produces no verdict so
 * the preview can still display the document.
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
