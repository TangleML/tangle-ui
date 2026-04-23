import { serializeComponentSpec } from "@/models/componentSpec";
import type { Task } from "@/models/componentSpec/entities/task";
import { componentSpecToText } from "@/utils/yaml";

export function getTaskYamlText(task: Task): string {
  if (task.componentRef.text) return task.componentRef.text;
  if (task.subgraphSpec) {
    return componentSpecToText(serializeComponentSpec(task.subgraphSpec));
  }
  const spec = task.componentRef.spec;
  return spec ? componentSpecToText(spec) : "";
}
