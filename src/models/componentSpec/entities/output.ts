import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import type { Annotation, TypeSpecType } from "./types";

export interface OutputInit {
  name: string;
  type?: TypeSpecType;
  description?: string;
}

@model("spec/Output")
export class Output extends Model({
  $id: idProp,
  name: prop<string>(),
  type: prop<TypeSpecType | undefined>(undefined),
  description: prop<string | undefined>(undefined),
  annotations: prop<Annotation[]>(() => []),
}) {
  @modelAction
  setName(name: string) {
    this.name = name;
  }

  @modelAction
  setType(type: TypeSpecType | undefined) {
    this.type = type;
  }

  @modelAction
  setDescription(description: string | undefined) {
    this.description = description;
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
}
