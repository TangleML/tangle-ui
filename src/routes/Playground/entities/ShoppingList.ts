import { BaseEntity } from "@/models/componentSpec/reactive/baseEntity";
import {
  indexed,
  observable,
} from "@/models/componentSpec/reactive/decorators";
import { EntityContext } from "@/models/componentSpec/reactive/entityContext";
import { ObservableArray } from "@/models/componentSpec/reactive/observableArray";

import type { ShoppingItem } from "./ShoppingItem";

export interface ShoppingListInit {
  name: string;
  dueDate?: Date;
}

export class ShoppingList extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor name: string;
  @observable accessor dueDate: Date | null;

  readonly items: ObservableArray<ShoppingItem>;

  constructor($id: string, init: ShoppingListInit, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? new EntityContext();

    this.$id = $id;
    this.name = init.name;
    this.dueDate = init.dueDate ?? null;

    this.subscribe("changed.*", (event) => {
      console.log("ShoppingList changed", this.$id, event);
    });

    console.log("ShoppingList constructor", this.$id, this.$ctx);
    this.items = new ObservableArray<ShoppingItem>(this);
  }

  isDone(): boolean {
    if (this.items.length === 0) return false;
    return this.items.every((item) => item.done);
  }
}
