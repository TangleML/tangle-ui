import {
  LINEAGE_ORIGIN_ANNOTATION,
  resolveLineageForRef,
} from "@/utils/lineage";

import { Task } from "../entities/task";
import type { Argument, ComponentReference } from "../entities/types";
import type { IdGenerator } from "./idGenerator";

export function createTaskFromComponentRef(
  idGen: IdGenerator,
  componentRef: ComponentReference,
  taskName: string,
): Task {
  const args: Argument[] = [];

  if (componentRef.spec?.inputs) {
    for (const input of componentRef.spec.inputs) {
      args.push({ name: input.name, value: input.default });
    }
  }

  const task = new Task({
    $id: idGen.next("task"),
    name: taskName,
    componentRef,
    arguments: args,
  });

  // Stamp the component's lineage so this instance can later be traced back to
  // its origin and reconciled, even after edits change its digest. Preserved
  // for free across edits (a componentRef swap leaves task annotations intact).
  const lineage = resolveLineageForRef(componentRef);
  if (lineage) {
    task.annotations.set(LINEAGE_ORIGIN_ANNOTATION, lineage);
  }

  return task;
}
