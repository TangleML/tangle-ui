import { beforeEach, describe, expect, it } from "vitest";

import { IndexManager } from "../../indexes/indexManager";

describe("IndexManager", () => {
  let im: IndexManager;

  beforeEach(() => {
    im = new IndexManager();
  });

  const createEntity = ($id: string, name: string) => ({
    $id,
    name,
    $namespace: "testentity",
  });

  it("indexes and finds entity", () => {
    const e = createEntity("1", "Alice");
    im.index(e, "$id");
    im.index(e, "name");

    expect(im.findOne("testentity", "$id", "1")).toBe(e);
    expect(im.findOne("testentity", "name", "Alice")).toBe(e);
  });

  it("find returns all matching entities", () => {
    const e1 = createEntity("1", "Same");
    const e2 = createEntity("2", "Same");
    im.index(e1, "name");
    im.index(e2, "name");

    const result = im.find("testentity", "name", "Same");

    expect(result).toHaveLength(2);
    expect(result).toContain(e1);
    expect(result).toContain(e2);
  });

  it("reindex updates index correctly", () => {
    const e = createEntity("1", "Old");
    im.index(e, "name");

    (e as any).name = "New";
    im.reindex(e, "name", "Old");

    expect(im.findOne("testentity", "name", "Old")).toBeUndefined();
    expect(im.findOne("testentity", "name", "New")).toBe(e);
  });

  it("unindex removes entity from index", () => {
    const e = createEntity("1", "Test");
    im.index(e, "$id");

    im.unindex(e, "$id");

    expect(im.findOne("testentity", "$id", "1")).toBeUndefined();
  });

  it("findOne returns undefined for no match", () => {
    expect(im.findOne("testentity", "$id", "nonexistent")).toBeUndefined();
  });

  it("find returns empty array for no match", () => {
    expect(im.find("testentity", "$id", "nonexistent")).toEqual([]);
  });

  it("clear removes all indexes", () => {
    const e = createEntity("1", "Test");
    im.index(e, "$id");
    im.index(e, "name");

    im.clear();

    expect(im.findOne("testentity", "$id", "1")).toBeUndefined();
    expect(im.findOne("testentity", "name", "Test")).toBeUndefined();
  });

  it("different namespaces are independent", () => {
    const e1 = { $id: "1", name: "Test", $namespace: "namespace_a" };
    const e2 = { $id: "1", name: "Test", $namespace: "namespace_b" };
    im.index(e1, "$id");
    im.index(e2, "$id");

    expect(im.findOne("namespace_a", "$id", "1")).toBe(e1);
    expect(im.findOne("namespace_b", "$id", "1")).toBe(e2);
  });

  it("same field different values", () => {
    const e1 = createEntity("1", "Alice");
    const e2 = createEntity("2", "Bob");
    im.index(e1, "name");
    im.index(e2, "name");

    expect(im.findOne("testentity", "name", "Alice")).toBe(e1);
    expect(im.findOne("testentity", "name", "Bob")).toBe(e2);
  });

  it("handles undefined field value", () => {
    const e = { $id: "1", name: undefined, $namespace: "testentity" };
    im.index(e, "name");

    expect(im.findOne("testentity", "name", undefined)).toBe(e);
  });

  it("handles null field value", () => {
    const e = { $id: "1", name: null, $namespace: "testentity" };
    im.index(e, "name");

    expect(im.findOne("testentity", "name", null)).toBe(e);
  });

  it("multiple indexes on same entity", () => {
    const e = {
      $id: "1",
      name: "Test",
      status: "active",
      $namespace: "testentity",
    };
    im.index(e, "$id");
    im.index(e, "name");
    im.index(e, "status");

    expect(im.findOne("testentity", "$id", "1")).toBe(e);
    expect(im.findOne("testentity", "name", "Test")).toBe(e);
    expect(im.findOne("testentity", "status", "active")).toBe(e);
  });

  it("reindex preserves other indexes", () => {
    const e = { $id: "1", name: "Old", $namespace: "testentity" };
    im.index(e, "$id");
    im.index(e, "name");

    (e as any).name = "New";
    im.reindex(e, "name", "Old");

    expect(im.findOne("testentity", "$id", "1")).toBe(e);
    expect(im.findOne("testentity", "name", "New")).toBe(e);
  });

  it("unindex only removes specified field", () => {
    const e = { $id: "1", name: "Test", $namespace: "testentity" };
    im.index(e, "$id");
    im.index(e, "name");

    im.unindex(e, "name");

    expect(im.findOne("testentity", "$id", "1")).toBe(e);
    expect(im.findOne("testentity", "name", "Test")).toBeUndefined();
  });
});
