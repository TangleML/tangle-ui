import { beforeEach, describe, expect, it, vi } from "vitest";

import { Input } from "../../entities/input";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("Input", () => {
  beforeEach(() => resetIndexManager());

  it("creates with name string", () => {
    const input = new Input("input_1", "myInput");

    expect(input.$id).toBe("input_1");
    expect(input.name).toBe("myInput");
  });

  it("creates with full init object", () => {
    const input = new Input("input_1", {
      name: "data",
      type: "string",
      description: "Input data",
      defaultValue: "default",
      optional: true,
    });

    expect(input.$id).toBe("input_1");
    expect(input.name).toBe("data");
    expect(input.type).toBe("string");
    expect(input.description).toBe("Input data");
    expect(input.defaultValue).toBe("default");
    expect(input.optional).toBe(true);
  });

  it("has empty annotations by default", () => {
    const input = new Input("input_1", "test");
    expect(input.annotations.length).toBe(0);
  });

  it("annotations are reactive", () => {
    const input = new Input("input_1", "test");
    const listener = vi.fn();
    input.annotations.subscribe("changed.self.*", listener);

    input.annotations.add({ key: "note", value: "important" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('$namespace is "input"', () => {
    const input = new Input("input_1", "test");
    expect(input.$namespace).toBe("input");
  });

  it("is indexed by $id and name", () => {
    const input = new Input("input_1", "myInput");

    expect(indexManager.findOne<Input>("input", "$id", "input_1")).toBe(input);
    expect(indexManager.findOne<Input>("input", "name", "myInput")).toBe(input);
  });

  it("emits change when name changes", () => {
    const input = new Input("input_1", "old");
    const listener = vi.fn();
    input.subscribe("changed.self.*", listener);

    input.name = "new";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "name",
        value: "new",
        oldValue: "old",
      }),
    );
  });

  it("emits change when type changes", () => {
    const input = new Input("input_1", { name: "test", type: "string" });
    const listener = vi.fn();
    input.subscribe("changed.self.*", listener);

    input.type = "number";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "type",
        value: "number",
        oldValue: "string",
      }),
    );
  });

  it("reindexes when name changes", () => {
    const input = new Input("input_1", "old");

    input.name = "new";

    expect(indexManager.findOne<Input>("input", "name", "old")).toBeUndefined();
    expect(indexManager.findOne<Input>("input", "name", "new")).toBe(input);
  });
});
