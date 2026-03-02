import { IncrementingIdGenerator } from "../factories/idGenerator";
import { isObservableNode, ObservableNode } from "./observableNode";

const idGenerator = new IncrementingIdGenerator();

export class ObservableArray<T> extends ObservableNode {
  readonly $id = idGenerator.next("collection");
  private items: T[] = [];

  constructor(owner?: ObservableNode) {
    super();
    if (owner) {
      this.attachToParent(owner);
    }
  }

  get length(): number {
    return this.items.length;
  }

  get all(): readonly T[] {
    return this.items;
  }

  add(item: T): void {
    this.items.push(item);
    this.connectChild(item);
    this.emit();
  }

  remove(index: number): T | undefined {
    const [removed] = this.items.splice(index, 1);
    if (removed) this.disconnectChild(removed);
    this.emit();
    return removed;
  }

  removeBy(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    this.items = this.items.filter((item) => {
      if (predicate(item)) {
        removed.push(item);
        this.disconnectChild(item);
        return false;
      }
      return true;
    });
    if (removed.length > 0) this.emit();
    return removed;
  }

  update(index: number, updates: Partial<T>): void {
    const item = this.items[index];
    if (item) {
      Object.assign(item, updates);
      this.emit();
    }
  }

  set(index: number, item: T): void {
    const oldItem = this.items[index];
    if (oldItem) this.disconnectChild(oldItem);
    this.items[index] = item;
    this.connectChild(item);
    this.emit();
  }

  clear(): void {
    for (const item of this.items) {
      this.disconnectChild(item);
    }
    this.items = [];
    this.emit();
  }

  at(index: number): T | undefined {
    return this.items[index];
  }

  find(predicate: (item: T, index: number) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  findIndex(predicate: (item: T, index: number) => boolean): number {
    return this.items.findIndex(predicate);
  }

  filter(predicate: (item: T, index: number) => boolean): T[] {
    return this.items.filter(predicate);
  }

  map<U>(fn: (item: T, index: number) => U): U[] {
    return this.items.map(fn);
  }

  some(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.some(predicate);
  }

  every(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.every(predicate);
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  private emit(): void {
    this.emitChange("changed.self.collection", "items", this.items, undefined);
  }

  private connectChild(item: T): void {
    console.log("connectChild", (item as any)["$id"]);
    if (!this.parent || !isObservableNode(item)) return;
    item.attachToParent(this.parent);
  }

  private disconnectChild(item: T): void {
    if (!isObservableNode(item)) return;
    item.detachFromParent();
  }
}
