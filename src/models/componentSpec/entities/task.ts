import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import type {
  Annotation,
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
  annotations: prop<Annotation[]>(() => []),
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
  addAnnotation(annotation: Annotation) {
    this.annotations.push(annotation);
  }

  @modelAction
  updateAnnotation(index: number, updates: Partial<Annotation>) {
    const ann = this.annotations[index];
    if (ann) Object.assign(ann, updates);
  }

  @modelAction
  removeAnnotation(index: number) {
    this.annotations.splice(index, 1);
  }

  @modelAction
  removeAnnotationByKey(key: string) {
    const idx = this.annotations.findIndex((a) => a.key === key);
    if (idx >= 0) this.annotations.splice(idx, 1);
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
