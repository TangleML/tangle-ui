import { Task } from "../entities/task";
import type { ComponentReference } from "../entities/types";
import type { IdGenerator } from "./idGenerator";

export function createTaskFromComponentRef(
  idGen: IdGenerator,
  componentRef: ComponentReference,
  taskName: string,
): Task {
  const task = new Task(idGen.next("task"), {
    name: taskName,
    componentRef,
  });

  if (componentRef.spec?.inputs) {
    for (const input of componentRef.spec.inputs) {
      task.arguments.add({
        name: input.name,
        value: input.default,
      });
    }
  }

  return task;
}
