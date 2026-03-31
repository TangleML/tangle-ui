import type { Task } from "@/models/componentSpec/entities/task";
import { componentSpecToText } from "@/utils/yaml";

export function getTaskYamlText(task: Task): string {
  return (
    task.componentRef.text ??
    (task.componentRef.spec ? componentSpecToText(task.componentRef.spec) : "")
  );
}
