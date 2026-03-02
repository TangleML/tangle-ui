import { BaseEntity } from "../reactive/baseEntity";
import { indexed, observable } from "../reactive/decorators";
import type { BindingEndpoint } from "./types";

export interface BindingInit {
  source: BindingEndpoint;
  target: BindingEndpoint;
}

export class Binding extends BaseEntity {
  @indexed accessor $id: string;
  @indexed accessor sourceEntityId: string;
  @indexed accessor targetEntityId: string;
  @observable accessor sourcePortName: string;
  @observable accessor targetPortName: string;

  constructor($id: string, init: BindingInit) {
    super();
    this.$id = $id;
    this.sourceEntityId = init.source.entityId;
    this.targetEntityId = init.target.entityId;
    this.sourcePortName = init.source.portName;
    this.targetPortName = init.target.portName;
  }

  get source(): BindingEndpoint {
    return { entityId: this.sourceEntityId, portName: this.sourcePortName };
  }

  get target(): BindingEndpoint {
    return { entityId: this.targetEntityId, portName: this.targetPortName };
  }
}
