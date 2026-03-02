import { beforeEach, describe, expect, it, vi } from "vitest";

import { Binding } from "../../entities/binding";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("Binding", () => {
  beforeEach(() => resetIndexManager());

  it("creates with required properties", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "output" },
      target: { entityId: "task_2", portName: "input" },
    });

    expect(binding.$id).toBe("binding_1");
    expect(binding.sourceEntityId).toBe("task_1");
    expect(binding.targetEntityId).toBe("task_2");
    expect(binding.sourcePortName).toBe("output");
    expect(binding.targetPortName).toBe("input");
  });

  it("provides source and target accessors", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "output" },
      target: { entityId: "task_2", portName: "input" },
    });

    expect(binding.source).toEqual({ entityId: "task_1", portName: "output" });
    expect(binding.target).toEqual({ entityId: "task_2", portName: "input" });
  });

  it('$namespace is "binding"', () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });
    expect(binding.$namespace).toBe("binding");
  });

  it("is indexed by $id", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });

    expect(indexManager.findOne<Binding>("binding", "$id", "binding_1")).toBe(
      binding,
    );
  });

  it("is indexed by sourceEntityId", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });

    expect(
      indexManager.findOne<Binding>("binding", "sourceEntityId", "task_1"),
    ).toBe(binding);
  });

  it("is indexed by targetEntityId", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });

    expect(
      indexManager.findOne<Binding>("binding", "targetEntityId", "task_2"),
    ).toBe(binding);
  });

  it("reindexes when sourceEntityId changes", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });

    binding.sourceEntityId = "task_3";

    expect(
      indexManager.findOne<Binding>("binding", "sourceEntityId", "task_1"),
    ).toBeUndefined();
    expect(
      indexManager.findOne<Binding>("binding", "sourceEntityId", "task_3"),
    ).toBe(binding);
  });

  it("emits change when port names change", () => {
    const binding = new Binding("binding_1", {
      source: { entityId: "task_1", portName: "out" },
      target: { entityId: "task_2", portName: "in" },
    });
    const listener = vi.fn();
    binding.subscribe("changed.self.*", listener);

    binding.sourcePortName = "output";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "sourcePortName",
        value: "output",
        oldValue: "out",
      }),
    );
  });

  it("can find all bindings by targetEntityId", () => {
    const binding1 = new Binding("b1", {
      source: { entityId: "t1", portName: "o1" },
      target: { entityId: "target", portName: "i1" },
    });
    const binding2 = new Binding("b2", {
      source: { entityId: "t2", portName: "o2" },
      target: { entityId: "target", portName: "i2" },
    });
    new Binding("b3", {
      source: { entityId: "t3", portName: "o3" },
      target: { entityId: "other", portName: "i3" },
    });

    const found = indexManager.find<Binding>(
      "binding",
      "targetEntityId",
      "target",
    );

    expect(found).toHaveLength(2);
    expect(found).toContain(binding1);
    expect(found).toContain(binding2);
  });
});
