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

  return new Task({
    $id: idGen.next("task"),
    name: taskName,
    componentRef,
    arguments: args,
  });
}
