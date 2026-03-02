import { BaseEntity } from "../reactive/baseEntity";
import { indexed, observable } from "../reactive/decorators";
import type { EntityContext } from "../reactive/entityContext";
import { ObservableArray } from "../reactive/observableArray";
import type { Annotation, TypeSpecType } from "./types";

export interface InputInit {
  name: string;
  type?: TypeSpecType;
  description?: string;
  defaultValue?: string;
  optional?: boolean;
}

export class Input extends BaseEntity {
  @indexed accessor $id: string;
  @indexed accessor name: string;
  @observable accessor type: TypeSpecType | undefined;
  @observable accessor description: string | undefined;
  @observable accessor defaultValue: string | undefined;
  @observable accessor optional: boolean | undefined;

  readonly annotations: ObservableArray<Annotation>;

  constructor($id: string, init: InputInit | string, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? null;

    // Create collections with this entity as owner
    this.annotations = new ObservableArray<Annotation>(this);

    this.$id = $id;
    if (typeof init === "string") {
      this.name = init;
      this.type = undefined;
      this.description = undefined;
      this.defaultValue = undefined;
      this.optional = undefined;
    } else {
      this.name = init.name;
      this.type = init.type;
      this.description = init.description;
      this.defaultValue = init.defaultValue;
      this.optional = init.optional;
    }
  }
}
