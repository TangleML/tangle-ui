import { beforeEach, describe, expect, it, vi } from "vitest";

import { Output } from "../../entities/output";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("Output", () => {
  beforeEach(() => resetIndexManager());

  it("creates with name string", () => {
    const output = new Output("output_1", "myOutput");

    expect(output.$id).toBe("output_1");
    expect(output.name).toBe("myOutput");
  });

  it("creates with full init object", () => {
    const output = new Output("output_1", {
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
    const output = new Output("output_1", "test");
    expect(output.annotations.length).toBe(0);
  });

  it("annotations are reactive", () => {
    const output = new Output("output_1", "test");
    const listener = vi.fn();
    output.annotations.subscribe("changed.self.*", listener);

    output.annotations.add({ key: "format", value: "json" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('$namespace is "output"', () => {
    const output = new Output("output_1", "test");
    expect(output.$namespace).toBe("output");
  });

  it("is indexed by $id and name", () => {
    const output = new Output("output_1", "myOutput");

    expect(indexManager.findOne<Output>("output", "$id", "output_1")).toBe(
      output,
    );
    expect(indexManager.findOne<Output>("output", "name", "myOutput")).toBe(
      output,
    );
  });

  it("emits change when properties change", () => {
    const output = new Output("output_1", { name: "test", type: "string" });
    const listener = vi.fn();
    output.subscribe("changed.self.*", listener);

    output.description = "New description";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "description",
        value: "New description",
        oldValue: undefined,
      }),
    );
  });

  it("reindexes when name changes", () => {
    const output = new Output("output_1", "old");

    output.name = "new";

    expect(
      indexManager.findOne<Output>("output", "name", "old"),
    ).toBeUndefined();
    expect(indexManager.findOne<Output>("output", "name", "new")).toBe(output);
  });
});
