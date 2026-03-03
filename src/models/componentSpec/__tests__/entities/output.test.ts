import { describe, expect, it } from "vitest";

import { Output } from "../../entities/output";

describe("Output", () => {
  it("creates with name", () => {
    const output = new Output({ $id: "output_1", name: "myOutput" });

    expect(output.$id).toBe("output_1");
    expect(output.name).toBe("myOutput");
  });

  it("creates with full init object", () => {
    const output = new Output({
      $id: "output_1",
      name: "result",
      type: "object",
      description: "Output result",
    });

    expect(output.$id).toBe("output_1");
    expect(output.name).toBe("result");
    expect(output.type).toBe("object");
    expect(output.description).toBe("Output result");
  });

  it("has empty annotations by default", () => {
    const output = new Output({ $id: "output_1", name: "test" });
    expect(output.annotations.length).toBe(0);
  });

  it("addAnnotation adds to annotations", () => {
    const output = new Output({ $id: "output_1", name: "test" });

    output.addAnnotation({ key: "format", value: "json" });

    expect(output.annotations.length).toBe(1);
    expect(output.annotations[0]).toEqual({ key: "format", value: "json" });
  });

  it("setName updates name", () => {
    const output = new Output({ $id: "output_1", name: "old" });

    output.setName("new");

    expect(output.name).toBe("new");
  });

  it("setDescription updates description", () => {
    const output = new Output({
      $id: "output_1",
      name: "test",
      type: "string",
    });

    output.setDescription("New description");

    expect(output.description).toBe("New description");
  });
});
