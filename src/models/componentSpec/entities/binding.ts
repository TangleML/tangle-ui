import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import type { BindingEndpoint } from "./types";

@model("spec/Binding")
export class Binding extends Model({
  $id: idProp,
  sourceEntityId: prop<string>(),
  targetEntityId: prop<string>(),
  sourcePortName: prop<string>(),
  targetPortName: prop<string>(),
}) {
  get source(): BindingEndpoint {
    return { entityId: this.sourceEntityId, portName: this.sourcePortName };
  }

  get target(): BindingEndpoint {
    return { entityId: this.targetEntityId, portName: this.targetPortName };
  }

  @modelAction
  setSourceEntityId(id: string) {
    this.sourceEntityId = id;
  }

  @modelAction
  setTargetEntityId(id: string) {
    this.targetEntityId = id;
  }

  @modelAction
  setSourcePortName(name: string) {
    this.sourcePortName = name;
  }

  @modelAction
  setTargetPortName(name: string) {
    this.targetPortName = name;
  }
}
