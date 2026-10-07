import {
  type ComponentReference,
  type ComponentSpec,
  isGraphImplementation,
  type TaskSpec,
} from "@/utils/componentSpec";

/**
 * The editor keeps component-library cache fields (`author`, `fetched_at`,
 * `id`, `data`, `createdAt`, `updatedAt`, favorite/ownership flags, ...) on each
 * `componentRef`. The backend validates `root_pipeline_task` as a strict
 * `TaskSpec` and rejects anything outside the standard reference shape, so those
 * extras are dropped before a write.
 */
function cleanComponentRef(ref: ComponentReference): ComponentReference {
  const cleaned: ComponentReference = {};
  if (ref.name !== undefined) cleaned.name = ref.name;
  if (ref.digest !== undefined) cleaned.digest = ref.digest;
  if (ref.tag !== undefined) cleaned.tag = ref.tag;
  if (ref.url !== undefined) cleaned.url = ref.url;
  if (ref.text !== undefined) cleaned.text = ref.text;
  if (ref.spec !== undefined) cleaned.spec = cleanSpec(ref.spec);
  return cleaned;
}

function cleanSpec(spec: ComponentSpec): ComponentSpec {
  if (!spec.implementation || !isGraphImplementation(spec.implementation)) {
    return spec;
  }

  const graph = spec.implementation.graph;
  const tasks: Record<string, TaskSpec> = {};
  for (const [name, task] of Object.entries(graph.tasks ?? {})) {
    tasks[name] = task.componentRef
      ? { ...task, componentRef: cleanComponentRef(task.componentRef) }
      : task;
  }

  return {
    ...spec,
    implementation: { ...spec.implementation, graph: { ...graph, tasks } },
  };
}

export function sanitizeSpecForBackend(spec: ComponentSpec): ComponentSpec {
  return cleanSpec(spec);
}
