import { idProp, Model, model, modelAction, prop } from "mobx-keystone";

@model("playground/ShoppingItem")
export class ShoppingItem extends Model({
  id: idProp,
  name: prop<string>(),
  brand: prop<string>(""),
  price: prop<number>(0),
  done: prop(false),
}) {
  @modelAction
  setDone(done: boolean) {
    this.done = done;
  }

  @modelAction
  setName(name: string) {
    this.name = name;
  }
}
