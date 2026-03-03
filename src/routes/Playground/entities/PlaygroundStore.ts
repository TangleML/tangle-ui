import { computed } from "mobx";
import { Model, model, modelAction, prop } from "mobx-keystone";

import { ShoppingList } from "./ShoppingList";

@model("playground/PlaygroundStore")
export class PlaygroundStore extends Model({
  lists: prop<ShoppingList[]>(() => []),
}) {
  @modelAction
  addList(list: ShoppingList): void {
    this.lists.push(list);
  }

  @modelAction
  removeList(index: number): void {
    this.lists.splice(index, 1);
  }

  @computed
  get totalLists(): number {
    return this.lists.length;
  }

  @computed
  get completedLists(): number {
    return this.lists.filter((l) => l.isDone).length;
  }

  @computed
  get totalItems(): number {
    return this.lists.reduce((sum, l) => sum + l.items.length, 0);
  }

  @computed
  get totalValue(): number {
    return this.lists.reduce(
      (sum, l) => sum + l.items.reduce((s, i) => s + i.price, 0),
      0,
    );
  }
}
