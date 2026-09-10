import { describe, expect, it } from "vitest";

import { ComponentSpec, Input, Output, Task } from "@/models/componentSpec";

import { chatEntityKindFromId, resolveChatEntity } from "./resolveChatEntity";

function buildSpec(): ComponentSpec {
  const spec = new ComponentSpec({ $id: "spec_1", name: "MyPipeline" });
  spec.addInput(
    new Input({ $id: "input_1", name: "raw_path", type: "String" }),
  );
  spec.addOutput(
    new Output({ $id: "output_1", name: "result", type: "String" }),
  );
  spec.addTask(
    new Task({
      $id: "task_1",
      name: "Load CSV",
      componentRef: { name: "load" },
    }),
  );
  return spec;
}

describe("resolveChatEntity", () => {
  it("returns undefined for a missing spec", () => {
    expect(resolveChatEntity(null, "task_1", "Load CSV")).toBeUndefined();
  });

  it("resolves by $id across kinds", () => {
    const spec = buildSpec();
    expect(resolveChatEntity(spec, "task_1", "ignored")).toEqual({
      entityId: "task_1",
      kind: "task",
    });
    expect(resolveChatEntity(spec, "input_1", "ignored")).toEqual({
      entityId: "input_1",
      kind: "input",
    });
    expect(resolveChatEntity(spec, "output_1", "ignored")).toEqual({
      entityId: "output_1",
      kind: "output",
    });
  });

  it("falls back to the label when the $id has drifted", () => {
    const spec = buildSpec();
    expect(resolveChatEntity(spec, "task_stale123", "Load CSV")).toEqual({
      entityId: "task_1",
      kind: "task",
    });
  });

  it("prefers an $id match over a label match", () => {
    const spec = buildSpec();
    // Label collides with the input name, but the id points at the task.
    expect(resolveChatEntity(spec, "task_1", "raw_path")).toEqual({
      entityId: "task_1",
      kind: "task",
    });
  });

  it("returns undefined when neither id nor label match", () => {
    const spec = buildSpec();
    expect(resolveChatEntity(spec, "task_gone", "Nope")).toBeUndefined();
  });
});

describe("chatEntityKindFromId", () => {
  it("infers kind from underscore-style ids", () => {
    expect(chatEntityKindFromId("task_abc")).toBe("task");
    expect(chatEntityKindFromId("input_abc")).toBe("input");
    expect(chatEntityKindFromId("output_abc")).toBe("output");
  });

  it("infers kind from dash-style placeholder ids", () => {
    expect(chatEntityKindFromId("task-abc123")).toBe("task");
    expect(chatEntityKindFromId("output-xyz789")).toBe("output");
  });

  it("returns unknown for unrecognized prefixes", () => {
    expect(chatEntityKindFromId("binding_1")).toBe("unknown");
    expect(chatEntityKindFromId("whatever")).toBe("unknown");
  });
});
