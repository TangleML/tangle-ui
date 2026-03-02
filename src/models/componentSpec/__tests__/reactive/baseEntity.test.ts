import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexManager } from "../../indexes/indexManager";
import { BaseEntity } from "../../reactive/baseEntity";
import { defineObservable } from "../../reactive/decorators";

class TestEntity extends BaseEntity {
  declare $id: string;
  declare name: string;

  constructor($id: string) {
    super();
    this.$id = $id;
    defineObservable(this, "name", "");
  }
}

describe("BaseEntity", () => {
  beforeEach(() => {
    resetIndexManager();
  });

  it("emits change event when property changes", () => {
    const entity = new TestEntity("test_1");
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.name = "NewName";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "changed.self.entity",
        source: entity,
        field: "name",
        value: "NewName",
        oldValue: "",
      }),
    );
  });

  it("does not emit when value is same", () => {
    const entity = new TestEntity("test_1");
    entity.name = "Same";
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.name = "Same";

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribe stops events", () => {
    const entity = new TestEntity("test_1");
    const listener = vi.fn();
    const unsub = entity.subscribe("changed.self.*", listener);

    unsub();
    entity.name = "NewName";

    expect(listener).not.toHaveBeenCalled();
  });

  it("$namespace returns lowercase class name", () => {
    const entity = new TestEntity("test_1");
    expect(entity.$namespace).toBe("testentity");
  });

  it("supports AbortController-based subscription", () => {
    const entity = new TestEntity("test_1");
    const controller = new AbortController();
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener, { signal: controller.signal });

    entity.name = "First";
    expect(listener).toHaveBeenCalledTimes(1);

    controller.abort();
    entity.name = "Second";
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("multiple subscribers receive events independently", () => {
    const entity = new TestEntity("test_1");
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    entity.subscribe("changed.self.*", listener1);
    entity.subscribe("changed.self.*", listener2);

    entity.name = "Changed";

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("emits correct oldValue and value", () => {
    const entity = new TestEntity("test_1");
    entity.name = "Initial";
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.name = "Updated";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "changed.self.entity",
        field: "name",
        value: "Updated",
        oldValue: "Initial",
      }),
    );
  });

  it("subscribes to specific event type", () => {
    const entity = new TestEntity("test_1");
    const listener = vi.fn();
    entity.subscribe("changed.self.entity", listener);

    entity.name = "Test";

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("wildcard * matches all events", () => {
    const entity = new TestEntity("test_1");
    const listener = vi.fn();
    entity.subscribe("*", listener);

    entity.name = "Test";

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
