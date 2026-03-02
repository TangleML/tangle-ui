import { observable } from "mobx";

export interface ShoppingItemInit {
  name: string;
  brand?: string;
  price?: number;
  done?: boolean;
}

export class ShoppingItem {
  readonly $id: string;
  @observable accessor name: string;
  @observable accessor brand: string;
  @observable accessor price: number;
  @observable accessor done: boolean;

  constructor($id: string, init: ShoppingItemInit) {
    this.$id = $id;
    this.name = init.name;
    this.brand = init.brand ?? "";
    this.price = init.price ?? 0;
    this.done = init.done ?? false;
  }
}
