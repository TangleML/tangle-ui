import { BaseEntity } from "../reactive/baseEntity";
import { indexed, observable } from "../reactive/decorators";
import type { EntityContext } from "../reactive/entityContext";
import { ObservableArray } from "../reactive/observableArray";
import type {
  Annotation,
  Argument,
  ComponentReference,
  PredicateType,
} from "./types";

export interface TaskInit {
  name: string;
  componentRef: ComponentReference;
  isEnabled?: PredicateType;
}

export class Task extends BaseEntity {
  @indexed accessor $id: string;
  @indexed accessor name: string;
  @observable accessor componentRef: ComponentReference;
  @observable accessor isEnabled: PredicateType | undefined;

  readonly annotations: ObservableArray<Annotation>;
  readonly arguments: ObservableArray<Argument>;

  constructor($id: string, init: TaskInit, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? null;

    // Create collections with this entity as owner
    this.annotations = new ObservableArray<Annotation>(this);
    this.arguments = new ObservableArray<Argument>(this);

    this.$id = $id;
    this.name = init.name;
    this.componentRef = init.componentRef;
    this.isEnabled = init.isEnabled;
  }
}
