import { describe, expect, it } from "vitest";

import { Input } from "../../entities/input";

describe("Input", () => {
  it("creates with name", () => {
    const input = new Input({ $id: "input_1", name: "myInput" });

    expect(input.$id).toBe("input_1");
    expect(input.name).toBe("myInput");
  });

  it("creates with full init object", () => {
    const input = new Input({
      $id: "input_1",
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
    const input = new Input({ $id: "input_1", name: "test" });
    expect(input.annotations.length).toBe(0);
  });

  it("annotations.add adds to annotations", () => {
    const input = new Input({ $id: "input_1", name: "test" });

    input.annotations.add({ key: "note", value: "important" });

    expect(input.annotations.length).toBe(1);
    expect(input.annotations.items[0]).toEqual({
      key: "note",
      value: "important",
    });
  });

  it("setName updates name", () => {
    const input = new Input({ $id: "input_1", name: "old" });

    input.setName("new");

    expect(input.name).toBe("new");
  });

  it("setType updates type", () => {
    const input = new Input({
      $id: "input_1",
      name: "test",
      type: "string",
    });

    input.setType("number");

    expect(input.type).toBe("number");
  });
});
