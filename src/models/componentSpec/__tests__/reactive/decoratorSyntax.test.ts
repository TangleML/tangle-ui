import { beforeEach, describe, expect, it, vi } from "vitest";

import { indexManager, resetIndexManager } from "../../indexes/indexManager";
import { BaseEntity } from "../../reactive/baseEntity";
import { indexed, observable } from "../../reactive/decorators";

class TestEntity extends BaseEntity {
  @indexed accessor $id: string;
  @indexed accessor name: string;
  @observable accessor description: string;

  constructor(id: string, name: string, description: string = "") {
    super();
    this.$id = id;
    this.name = name;
    this.description = description;
  }
}

describe("TC39 Decorator Syntax", () => {
  beforeEach(() => {
    resetIndexManager();
  });

  it("@observable emits change events", () => {
    const entity = new TestEntity("1", "test");
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.description = "new description";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "description",
        value: "new description",
        oldValue: "",
      }),
    );
  });

  it("@observable does not emit when value unchanged", () => {
    const entity = new TestEntity("1", "test", "same");
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.description = "same";

    expect(listener).not.toHaveBeenCalled();
  });

  it("@indexed registers entity in index", () => {
    const entity = new TestEntity("entity-1", "MyEntity");

    const found = indexManager.findOne("testentity", "$id", "entity-1");

    expect(found).toBe(entity);
  });

  it("@indexed updates index on value change", () => {
    const entity = new TestEntity("entity-1", "OldName");

    entity.name = "NewName";

    expect(
      indexManager.findOne("testentity", "name", "OldName"),
    ).toBeUndefined();
    expect(indexManager.findOne("testentity", "name", "NewName")).toBe(entity);
  });

  it("@indexed emits change events", () => {
    const entity = new TestEntity("1", "original");
    const listener = vi.fn();
    entity.subscribe("changed.self.*", listener);

    entity.name = "updated";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "name",
        value: "updated",
        oldValue: "original",
      }),
    );
  });

  it("multiple @indexed fields work independently", () => {
    const entity = new TestEntity("id-123", "EntityName");

    expect(indexManager.findOne("testentity", "$id", "id-123")).toBe(entity);
    expect(indexManager.findOne("testentity", "name", "EntityName")).toBe(
      entity,
    );
  });

  it("getter returns current value", () => {
    const entity = new TestEntity("1", "test", "desc");

    expect(entity.$id).toBe("1");
    expect(entity.name).toBe("test");
    expect(entity.description).toBe("desc");

    entity.name = "updated";
    expect(entity.name).toBe("updated");
  });
});
