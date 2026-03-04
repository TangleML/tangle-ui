import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { Annotations } from "../annotations";
import type { TypeSpecType } from "./types";

export interface InputInit {
  name: string;
  type?: TypeSpecType;
  description?: string;
  defaultValue?: string;
  optional?: boolean;
}

@model("spec/Input")
export class Input extends Model({
  $id: idProp,
  name: prop<string>(),
  type: prop<TypeSpecType | undefined>(undefined),
  description: prop<string | undefined>(undefined),
  defaultValue: prop<string | undefined>(undefined),
  optional: prop<boolean | undefined>(undefined),
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

  @modelAction
  setDefaultValue(defaultValue: string | undefined) {
    this.defaultValue = defaultValue;
  }

  @modelAction
  setOptional(optional: boolean | undefined) {
    this.optional = optional;
  }
}
