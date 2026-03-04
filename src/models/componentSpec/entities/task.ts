import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { Annotations } from "../annotations";
import type {
  Argument,
  ArgumentType,
  ComponentReference,
  PredicateType,
} from "./types";

export interface TaskInit {
  name: string;
  componentRef: ComponentReference;
  isEnabled?: PredicateType;
}

@model("spec/Task")
export class Task extends Model({
  $id: idProp,
  name: prop<string>(),
  componentRef: prop<ComponentReference>(),
  isEnabled: prop<PredicateType | undefined>(undefined),
  annotations: prop<Annotations>(() => new Annotations({})),
  arguments: prop<Argument[]>(() => []),
}) {
  @modelAction
  setName(name: string) {
    this.name = name;
  }

  @modelAction
  setComponentRef(ref: ComponentReference) {
    this.componentRef = ref;
  }

  @modelAction
  setIsEnabled(predicate: PredicateType | undefined) {
    this.isEnabled = predicate;
  }

  @modelAction
  addArgument(arg: Argument) {
    this.arguments.push(arg);
  }

  @modelAction
  setArgument(name: string, value: ArgumentType | undefined) {
    const idx = this.arguments.findIndex((a) => a.name === name);
    if (idx >= 0) {
      this.arguments[idx] = { name, value };
    } else {
      this.arguments.push({ name, value });
    }
  }

  @modelAction
  removeArgument(index: number) {
    this.arguments.splice(index, 1);
  }

  @modelAction
  removeArgumentByName(name: string) {
    const idx = this.arguments.findIndex((a) => a.name === name);
    if (idx >= 0) this.arguments.splice(idx, 1);
  }

  @modelAction
  clearArguments() {
    this.arguments.splice(0, this.arguments.length);
  }
}
