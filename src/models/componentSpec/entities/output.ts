import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { Annotations } from "../annotations";
import type { TypeSpecType } from "./types";

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
  annotations: prop<Annotations>(() => new Annotations({})),
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
}
