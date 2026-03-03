import { describe, expect, it } from "vitest";

import { Binding } from "../../entities/binding";

describe("Binding", () => {
  it("creates with required properties", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "output",
      targetPortName: "input",
    });

    expect(binding.$id).toBe("binding_1");
    expect(binding.sourceEntityId).toBe("task_1");
    expect(binding.targetEntityId).toBe("task_2");
    expect(binding.sourcePortName).toBe("output");
    expect(binding.targetPortName).toBe("input");
  });

  it("provides source and target accessors", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "output",
      targetPortName: "input",
    });

    expect(binding.source).toEqual({ entityId: "task_1", portName: "output" });
    expect(binding.target).toEqual({ entityId: "task_2", portName: "input" });
  });

  it("setSourceEntityId updates sourceEntityId", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "out",
      targetPortName: "in",
    });

    binding.setSourceEntityId("task_3");

    expect(binding.sourceEntityId).toBe("task_3");
  });

  it("setTargetEntityId updates targetEntityId", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "out",
      targetPortName: "in",
    });

    binding.setTargetEntityId("task_3");

    expect(binding.targetEntityId).toBe("task_3");
  });

  it("setSourcePortName updates sourcePortName", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "out",
      targetPortName: "in",
    });

    binding.setSourcePortName("output");

    expect(binding.sourcePortName).toBe("output");
  });

  it("setTargetPortName updates targetPortName", () => {
    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      targetEntityId: "task_2",
      sourcePortName: "out",
      targetPortName: "in",
    });

    binding.setTargetPortName("input");

    expect(binding.targetPortName).toBe("input");
  });
});
