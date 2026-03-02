import { BaseEntity } from "@/models/componentSpec/reactive/baseEntity";
import {
  indexed,
  observable,
} from "@/models/componentSpec/reactive/decorators";

export interface ShoppingItemInit {
  name: string;
  brand?: string;
  price?: number;
  done?: boolean;
}

export class ShoppingItem extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor name: string;
  @observable accessor brand: string;
  @observable accessor price: number;
  @observable accessor done: boolean;

  constructor($id: string, init: ShoppingItemInit) {
    super();
    this.$id = $id;
    this.name = init.name;
    this.brand = init.brand ?? "";
    this.price = init.price ?? 0;
    this.done = init.done ?? false;
  }
}
