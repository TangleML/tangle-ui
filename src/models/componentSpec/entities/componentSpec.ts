import { BaseEntity } from "../reactive/baseEntity";
import { indexed, observable } from "../reactive/decorators";
import { EntityContext } from "../reactive/entityContext";
import { ObservableArray } from "../reactive/observableArray";
import type { Binding } from "./binding";
import type { Input } from "./input";
import type { Output } from "./output";
import type { Task } from "./task";
import type { Annotation } from "./types";

export class ComponentSpec extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor name: string;
  @observable accessor description: string | undefined;

  readonly inputs: ObservableArray<Input>;
  readonly outputs: ObservableArray<Output>;
  readonly tasks: ObservableArray<Task>;
  readonly bindings: ObservableArray<Binding>;
  readonly annotations: ObservableArray<Annotation>;

  constructor($id: string, name: string, ctx?: EntityContext) {
    super();
    // Set context (create new one if not provided - ComponentSpec is typically a root entity)
    this.$ctx = ctx ?? new EntityContext();

    // Create collections with this entity as owner
    this.inputs = new ObservableArray<Input>(this);
    this.outputs = new ObservableArray<Output>(this);
    this.tasks = new ObservableArray<Task>(this);
    this.bindings = new ObservableArray<Binding>(this);
    this.annotations = new ObservableArray<Annotation>(this);

    this.$id = $id;
    this.name = name;
    this.description = undefined;
  }

  getMetadata(key: string): unknown {
    return this.annotations.find((a) => a.key === `metadata.${key}`)?.value;
  }

  setMetadata(key: string, value: unknown): void {
    const idx = this.annotations.findIndex((a) => a.key === `metadata.${key}`);
    if (idx >= 0) {
      this.annotations.update(idx, { value });
    } else {
      this.annotations.add({ key: `metadata.${key}`, value });
    }
  }
}
