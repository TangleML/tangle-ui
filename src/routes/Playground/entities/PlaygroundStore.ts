import { action, computed, observable } from "mobx";

import type { ShoppingList } from "./ShoppingList";

export class PlaygroundStore {
  @observable.shallow accessor lists: ShoppingList[] = [];

  @action addList(list: ShoppingList): void {
    this.lists.push(list);
  }

  @action removeList(index: number): void {
    this.lists.splice(index, 1);
  }

  @computed get totalLists(): number {
    return this.lists.length;
  }

  @computed get completedLists(): number {
    return this.lists.filter((l) => l.isDone).length;
  }

  @computed get totalItems(): number {
    return this.lists.reduce((sum, l) => sum + l.items.length, 0);
  }

  @computed get totalValue(): number {
    return this.lists.reduce(
      (sum, l) => sum + l.items.reduce((s, i) => s + i.price, 0),
      0,
    );
  }
}
