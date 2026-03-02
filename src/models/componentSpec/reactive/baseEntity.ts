import type { EntityContext } from "./entityContext";
import { ObservableNode } from "./observableNode";

function isBaseEntity(item: unknown): item is BaseEntity {
  return item !== null && typeof item === "object" && "$ctx" in item;
}

export abstract class BaseEntity extends ObservableNode {
  abstract readonly $id: string;
  $ctx: EntityContext | null = null;

  get $namespace(): string {
    return this.constructor.name.toLowerCase();
  }

  protected emitChange(field: string, value: unknown, oldValue: unknown): void {
    super.emitChange("changed.self.entity", field, value, oldValue);
  }

  protected override onAttached(parent: ObservableNode): void {
    if (isBaseEntity(parent) && parent.$ctx) {
      this.$ctx = parent.$ctx.child(parent);
    }
  }

  protected override onDetached(): void {
    this.$ctx = null;
  }
}
