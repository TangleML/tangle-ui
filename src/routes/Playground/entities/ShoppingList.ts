import { computed } from "mobx";
import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

import { ShoppingItem } from "./ShoppingItem";

@model("playground/ShoppingList")
export class ShoppingList extends Model({
  id: idProp,
  name: prop<string>(),
  dueDate: prop<string | null>(null),
  items: prop<ShoppingItem[]>(() => []),
}) {
  @computed
  get isDone(): boolean {
    if (this.items.length === 0) return false;
    return this.items.every((item) => item.done);
  }

  @modelAction
  addItem(item: ShoppingItem): void {
    this.items.push(item);
  }

  @modelAction
  removeItem(index: number): void {
    this.items.splice(index, 1);
  }
}
