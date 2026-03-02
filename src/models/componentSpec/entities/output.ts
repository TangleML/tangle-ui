import { BaseEntity } from "../reactive/baseEntity";
import { indexed, observable } from "../reactive/decorators";
import type { EntityContext } from "../reactive/entityContext";
import { ObservableArray } from "../reactive/observableArray";
import type { Annotation, TypeSpecType } from "./types";

export interface OutputInit {
  name: string;
  type?: TypeSpecType;
  description?: string;
}

export class Output extends BaseEntity {
  @indexed accessor $id: string;
  @indexed accessor name: string;
  @observable accessor type: TypeSpecType | undefined;
  @observable accessor description: string | undefined;

  readonly annotations: ObservableArray<Annotation>;

  constructor($id: string, init: OutputInit | string, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? null;

    // Create collections with this entity as owner
    this.annotations = new ObservableArray<Annotation>(this);

    this.$id = $id;
    if (typeof init === "string") {
      this.name = init;
      this.type = undefined;
      this.description = undefined;
    } else {
      this.name = init.name;
      this.type = init.type;
      this.description = init.description;
    }
  }
}
