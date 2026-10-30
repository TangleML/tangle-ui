import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type { ComponentReference } from "@/models/componentSpec/entities/types";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { createTaskFromComponentRef } from "@/models/componentSpec/factories/taskFactory";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import { canonicalHash } from "../snapshot";
import { applyCommand } from "./applyCommand";
import { addTaskCommand } from "./createCommands";

const containerRef: ComponentReference = {
  name: "Train",
  spec: {
    name: "Train",
    inputs: [{ name: "path", type: "String", default: "/data" }],
    implementation: { container: { image: "train:1" } },
  },
};

const subgraphRef: ComponentReference = {
  name: "Inner",
  spec: {
    name: "Inner",
    inputs: [],
    implementation: { graph: { tasks: {} } },
  },
};

function makeSpec(): ComponentSpec {
  return new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
}

function addTask(spec: ComponentSpec, name: string): string {
  const task = createTaskFromComponentRef(
    new IncrementingIdGenerator(),
    containerRef,
    name,
  );
  applyCommand(spec, addTaskCommand(task));
  return task.$id;
}

describe("applyCommand", () => {
  it("rebuilds an added task from its id-bearing snapshot next to siblings", () => {
    const spec = makeSpec();
    const firstId = addTask(spec, "A");
    const secondId = addTask(spec, "B");

    expect(spec.tasks.map((t) => t.$id)).toEqual([firstId, secondId]);
    expect(spec.tasks.map((t) => t.name)).toEqual(["A", "B"]);
    expect(spec.tasks[1].arguments).toEqual([{ name: "path", value: "/data" }]);
  });

  it("is a no-op when the target task is missing", () => {
    const spec = makeSpec();
    const before = canonicalHash(spec);

    applyCommand(spec, { type: "deleteTask", taskId: "ghost" });
    applyCommand(spec, { type: "renameTask", taskId: "ghost", name: "X" });
    applyCommand(spec, {
      type: "setTaskArgument",
      taskId: "ghost",
      portName: "path",
      value: "v",
    });
    applyCommand(spec, {
      type: "setTaskPosition",
      taskId: "ghost",
      position: { x: 5, y: 5 },
    });

    expect(canonicalHash(spec)).toBe(before);
  });

  it("assigns the command's binding id and clears the literal argument on connect", () => {
    const spec = makeSpec();
    const sourceId = addTask(spec, "Source");
    const targetId = addTask(spec, "Target");

    applyCommand(spec, {
      type: "setTaskArgument",
      taskId: targetId,
      portName: "path",
      value: "/literal",
    });
    applyCommand(spec, {
      type: "connectNodes",
      bindingId: "binding_fixed",
      source: { entityId: sourceId, portName: "model" },
      target: { entityId: targetId, portName: "path" },
    });

    expect(spec.bindings).toHaveLength(1);
    expect(spec.bindings[0].$id).toBe("binding_fixed");
    const target = spec.tasks.find((t) => t.$id === targetId);
    expect(target?.arguments.some((a) => a.name === "path")).toBe(false);
  });

  it("replaces an existing binding on the same target port", () => {
    const spec = makeSpec();
    const firstSource = addTask(spec, "First");
    const secondSource = addTask(spec, "Second");
    const targetId = addTask(spec, "Target");

    applyCommand(spec, {
      type: "connectNodes",
      bindingId: "binding_1",
      source: { entityId: firstSource, portName: "model" },
      target: { entityId: targetId, portName: "path" },
    });
    applyCommand(spec, {
      type: "connectNodes",
      bindingId: "binding_2",
      source: { entityId: secondSource, portName: "model" },
      target: { entityId: targetId, portName: "path" },
    });

    expect(spec.bindings).toHaveLength(1);
    expect(spec.bindings[0].$id).toBe("binding_2");
    expect(spec.bindings[0].sourceEntityId).toBe(secondSource);
  });

  it("removes every binding touching a deleted task", () => {
    const spec = makeSpec();
    const sourceId = addTask(spec, "Source");
    const targetId = addTask(spec, "Target");

    applyCommand(spec, {
      type: "connectNodes",
      bindingId: "binding_1",
      source: { entityId: sourceId, portName: "model" },
      target: { entityId: targetId, portName: "path" },
    });
    applyCommand(spec, { type: "deleteTask", taskId: sourceId });

    expect(spec.tasks.map((t) => t.$id)).toEqual([targetId]);
    expect(spec.bindings).toHaveLength(0);
  });

  it("resets the run condition when the is-enabled edge is deleted", () => {
    const spec = makeSpec();
    const sourceId = addTask(spec, "Source");
    const targetId = addTask(spec, "Target");

    const target = spec.tasks.find((t) => t.$id === targetId);
    target?.setIsEnabled("false");

    applyCommand(spec, {
      type: "connectNodes",
      bindingId: "binding_enabled",
      source: { entityId: sourceId, portName: "ok" },
      target: { entityId: targetId, portName: IS_ENABLED_PORT_NAME },
    });
    applyCommand(spec, { type: "deleteEdge", bindingId: "binding_enabled" });

    expect(spec.bindings).toHaveLength(0);
    expect(target?.isEnabled).toBe("true");
  });

  it("rejects a rename that collides with another task name", () => {
    const spec = makeSpec();
    const firstId = addTask(spec, "A");
    addTask(spec, "B");

    applyCommand(spec, { type: "renameTask", taskId: firstId, name: "B" });

    expect(spec.tasks.map((t) => t.name)).toEqual(["A", "B"]);
  });

  it("rewrites componentRef.name when renaming a subgraph task", () => {
    const spec = makeSpec();
    const task = createTaskFromComponentRef(
      new IncrementingIdGenerator(),
      subgraphRef,
      "Inner",
    );
    applyCommand(spec, addTaskCommand(task));

    applyCommand(spec, { type: "renameTask", taskId: task.$id, name: "Outer" });

    const renamed = spec.tasks.find((t) => t.$id === task.$id);
    expect(renamed?.subgraphSpec).toBeDefined();
    expect(renamed?.name).toBe("Outer");
    expect(renamed?.componentRef.name).toBe("Outer");
  });
});
