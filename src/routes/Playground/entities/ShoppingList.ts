import { action, computed, observable } from "mobx";

import type { ShoppingItem } from "./ShoppingItem";

export interface ShoppingListInit {
  name: string;
  dueDate?: Date;
}

export class ShoppingList {
  readonly $id: string;
  @observable accessor name: string;
  @observable accessor dueDate: Date | null;
  @observable.shallow accessor items: ShoppingItem[] = [];

  constructor($id: string, init: ShoppingListInit) {
    this.$id = $id;
    this.name = init.name;
    this.dueDate = init.dueDate ?? null;
  }

  @computed get isDone(): boolean {
    if (this.items.length === 0) return false;
    return this.items.every((item) => item.done);
  }

  @action addItem(item: ShoppingItem): void {
    this.items.push(item);
  }

  @action removeItem(index: number): void {
    this.items.splice(index, 1);
  }
}
