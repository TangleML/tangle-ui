import { beforeEach, describe, expect, it, vi } from "vitest";

import { IndexManager, resetIndexManager } from "../../indexes/indexManager";
import { BaseEntity } from "../../reactive/baseEntity";
import { indexed, observable } from "../../reactive/decorators";
import { EntityContext } from "../../reactive/entityContext";
import { ObservableArray } from "../../reactive/observableArray";

class Parent extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor name: string;
  readonly children: ObservableArray<Child>;

  constructor($id: string, name: string, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? new EntityContext();
    this.children = new ObservableArray<Child>(this);
    this.$id = $id;
    this.name = name;
  }
}

class Child extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor value: number;
  readonly items: ObservableArray<GrandChild>;

  constructor($id: string, value: number, ctx?: EntityContext) {
    super();
    this.$ctx = ctx ?? null;
    this.items = new ObservableArray<GrandChild>(this);
    this.$id = $id;
    this.value = value;
  }
}

class GrandChild extends BaseEntity {
  @indexed accessor $id: string;
  @observable accessor data: string;

  constructor($id: string, data: string) {
    super();
    this.$id = $id;
    this.data = data;
  }
}

describe("Event Bubbling", () => {
  beforeEach(() => resetIndexManager());

  describe("parent-child relationships", () => {
    it("sets parent and $ctx on child when added to ObservableArray", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);

      expect(child.$ctx).toBeNull();
      expect(child.parent).toBeNull();
      parent.children.add(child);
      expect(child.$ctx).not.toBeNull();
      expect(child.$ctx?.parent).toBe(parent);
      expect(child.parent).toBe(parent);
    });

    it("clears parent and $ctx on child when removed from ObservableArray", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);

      parent.children.add(child);
      expect(child.$ctx?.parent).toBe(parent);
      expect(child.parent).toBe(parent);

      parent.children.remove(0);
      expect(child.$ctx).toBeNull();
      expect(child.parent).toBeNull();
    });

    it("handles removeBy correctly", () => {
      const parent = new Parent("p1", "Parent");
      const child1 = new Child("c1", 1);
      const child2 = new Child("c2", 2);

      parent.children.add(child1);
      parent.children.add(child2);

      parent.children.removeBy((c) => c.$id === "c1");

      expect(child1.$ctx).toBeNull();
      expect(child1.parent).toBeNull();
      expect(child2.$ctx?.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });

    it("handles clear correctly", () => {
      const parent = new Parent("p1", "Parent");
      const child1 = new Child("c1", 1);
      const child2 = new Child("c2", 2);

      parent.children.add(child1);
      parent.children.add(child2);

      parent.children.clear();

      expect(child1.$ctx).toBeNull();
      expect(child1.parent).toBeNull();
      expect(child2.$ctx).toBeNull();
      expect(child2.parent).toBeNull();
    });

    it("handles set (replace) correctly", () => {
      const parent = new Parent("p1", "Parent");
      const child1 = new Child("c1", 1);
      const child2 = new Child("c2", 2);

      parent.children.add(child1);
      parent.children.set(0, child2);

      expect(child1.$ctx).toBeNull();
      expect(child1.parent).toBeNull();
      expect(child2.$ctx?.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });
  });

  describe("changed.child event bubbling", () => {
    it("emits changed.child on parent when child property changes", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const childChangeListener = vi.fn();
      parent.subscribe("changed.child", childChangeListener);

      child.value = 100;

      expect(childChangeListener).toHaveBeenCalledTimes(1);
      expect(childChangeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "changed.child",
          source: child,
          field: "value",
          oldValue: 42,
          value: 100,
        }),
      );
    });

    it("does not emit changed.child for parent's own property changes", () => {
      const parent = new Parent("p1", "Parent");

      const childChangeListener = vi.fn();
      parent.subscribe("changed.child", childChangeListener);

      parent.name = "New Name";

      expect(childChangeListener).not.toHaveBeenCalled();
    });

    it("bubbles changed.child through multiple levels (grandchild to parent)", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const grandchild = new GrandChild("g1", "hello");
      child.items.add(grandchild);

      const parentChildChangeListener = vi.fn();
      parent.subscribe("changed.child", parentChildChangeListener);

      grandchild.data = "world";

      expect(parentChildChangeListener).toHaveBeenCalledTimes(1);
      expect(parentChildChangeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "changed.child",
          source: grandchild,
          field: "data",
          oldValue: "hello",
          value: "world",
        }),
      );
    });

    it("stops bubbling after child is removed", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const childChangeListener = vi.fn();
      parent.subscribe("changed.child", childChangeListener);

      child.value = 100;
      expect(childChangeListener).toHaveBeenCalledTimes(1);

      parent.children.remove(0);
      childChangeListener.mockClear();

      child.value = 200;
      expect(childChangeListener).not.toHaveBeenCalled();
    });

    it("handles multiple children independently", () => {
      const parent = new Parent("p1", "Parent");
      const child1 = new Child("c1", 1);
      const child2 = new Child("c2", 2);
      parent.children.add(child1);
      parent.children.add(child2);

      const childChangeListener = vi.fn();
      parent.subscribe("changed.child", childChangeListener);

      child1.value = 10;
      child2.value = 20;

      expect(childChangeListener).toHaveBeenCalledTimes(2);
    });
  });

  describe("subscribe patterns", () => {
    it("returns unsubscribe function", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const listener = vi.fn();
      const unsub = parent.subscribe("changed.child", listener);

      child.value = 100;
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      child.value = 200;
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("subscribe with AbortSignal works", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const controller = new AbortController();
      const listener = vi.fn();
      parent.subscribe("changed.child", listener, {
        signal: controller.signal,
      });

      child.value = 100;
      expect(listener).toHaveBeenCalledTimes(1);

      controller.abort();
      child.value = 200;
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("changed.* wildcard receives both self and child events", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const listener = vi.fn();
      parent.subscribe("changed.*", listener);

      parent.name = "New Name";
      child.value = 100;

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("changed.self.* wildcard receives only self events", () => {
      const parent = new Parent("p1", "Parent");
      const child = new Child("c1", 42);
      parent.children.add(child);

      const listener = vi.fn();
      parent.subscribe("changed.self.*", listener);

      parent.name = "New Name";
      child.value = 100;

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "changed.self.entity",
          field: "name",
        }),
      );
    });
  });
});

describe("EntityContext", () => {
  it("creates context with default values", () => {
    const ctx = new EntityContext();

    expect(ctx.parent).toBeNull();
    expect(ctx.indexManager).toBeDefined();
    expect(ctx.idGenerator).toBeDefined();
  });

  it("creates context with custom values", () => {
    const parent = new Parent("p1", "Parent");
    const customIndexManager = new IndexManager();
    const ctx = new EntityContext({
      parent,
      indexManager: customIndexManager,
    });

    expect(ctx.parent).toBe(parent);
    expect(ctx.indexManager).toBe(customIndexManager);
  });

  it("child() creates child context inheriting services", () => {
    const customIndexManager = new IndexManager();
    const parentCtx = new EntityContext({ indexManager: customIndexManager });
    const parent = new Parent("p1", "Parent", parentCtx);

    const childCtx = parentCtx.child(parent);

    expect(childCtx.parent).toBe(parent);
    expect(childCtx.indexManager).toBe(customIndexManager);
    expect(childCtx.idGenerator).toBe(parentCtx.idGenerator);
  });

  it("nextId() generates unique IDs", () => {
    const ctx = new EntityContext();

    const id1 = ctx.nextId("test");
    const id2 = ctx.nextId("test");

    expect(id1).toContain("test_");
    expect(id2).toContain("test_");
    expect(id1).not.toBe(id2);
  });
});

describe("Playground Scenario (mobx-keystone)", () => {
  it("ShoppingList.isDone reacts to ShoppingItem.done changes", async () => {
    const { autorun } = await import("mobx");
    const { ShoppingList } =
      await import("@/routes/Playground/entities/ShoppingList");
    const { ShoppingItem } =
      await import("@/routes/Playground/entities/ShoppingItem");

    const list = new ShoppingList({ name: "Groceries" });
    const item = new ShoppingItem({ name: "Milk", done: false });

    list.addItem(item);

    expect(list.items).toHaveLength(1);
    expect(list.isDone).toBe(false);

    const observed: boolean[] = [];
    autorun(() => {
      observed.push(list.isDone);
    });

    item.setDone(true);

    expect(list.isDone).toBe(true);
    expect(observed).toEqual([false, true]);
  });
});

describe("Scoped IndexManager", () => {
  it("uses context's IndexManager when available", () => {
    const scopedIndexManager = new IndexManager();
    const ctx = new EntityContext({ indexManager: scopedIndexManager });
    const parent = new Parent("p1", "Parent", ctx);

    const foundInScoped = scopedIndexManager.findOne<Parent>(
      "parent",
      "$id",
      "p1",
    );
    expect(foundInScoped).toBe(parent);
  });

  it("child entities use inherited IndexManager when context is passed at construction", () => {
    const scopedIndexManager = new IndexManager();
    const ctx = new EntityContext({ indexManager: scopedIndexManager });
    const parent = new Parent("p1", "Parent", ctx);

    const childCtx = ctx.child(parent);
    const child = new Child("c1", 42, childCtx);
    parent.children.add(child);

    const foundChild = scopedIndexManager.findOne<Child>("child", "$id", "c1");
    expect(foundChild).toBe(child);
  });

  it("child entities added without context use global IndexManager initially", () => {
    const scopedIndexManager = new IndexManager();
    const ctx = new EntityContext({ indexManager: scopedIndexManager });
    const parent = new Parent("p1", "Parent", ctx);

    const child = new Child("c1", 42);
    parent.children.add(child);

    expect(child.$ctx).not.toBeNull();
    expect(child.$ctx?.indexManager).toBe(scopedIndexManager);
  });

  it("different scopes have isolated indexes", () => {
    const scope1 = new EntityContext({ indexManager: new IndexManager() });
    const scope2 = new EntityContext({ indexManager: new IndexManager() });

    const parent1 = new Parent("p1", "Parent1", scope1);
    const parent2 = new Parent("p1", "Parent2", scope2);

    const foundInScope1 = scope1.indexManager.findOne<Parent>(
      "parent",
      "$id",
      "p1",
    );
    const foundInScope2 = scope2.indexManager.findOne<Parent>(
      "parent",
      "$id",
      "p1",
    );

    expect(foundInScope1).toBe(parent1);
    expect(foundInScope2).toBe(parent2);
    expect(foundInScope1).not.toBe(foundInScope2);
  });
});
