import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";

import { findTaskContext } from "./findTaskContext";

const task = ($id: string, name: string, subgraphSpec?: ComponentSpec) =>
  new Task({ $id, name, componentRef: {}, subgraphSpec });

describe("findTaskContext", () => {
  it("finds a root-level task in the root spec", () => {
    const root = new ComponentSpec({
      name: "Root",
      tasks: [task("a", "A"), task("b", "B")],
    });

    const ctx = findTaskContext(root, "b");

    expect(ctx?.spec).toBe(root);
    expect(ctx?.task.name).toBe("B");
  });

  it("finds a nested task and returns its containing subgraph spec", () => {
    const sub = new ComponentSpec({
      name: "Sub",
      tasks: [task("nested", "Nested")],
    });
    const root = new ComponentSpec({
      name: "Root",
      tasks: [task("group", "Group", sub)],
    });

    const ctx = findTaskContext(root, "nested");

    expect(ctx?.spec).toBe(sub);
    expect(ctx?.task.name).toBe("Nested");
  });

  it("returns undefined when the task is absent", () => {
    const root = new ComponentSpec({ name: "Root", tasks: [task("a", "A")] });

    expect(findTaskContext(root, "missing")).toBeUndefined();
  });
});
