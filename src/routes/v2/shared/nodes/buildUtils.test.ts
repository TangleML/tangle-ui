import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { Task } from "@/models/componentSpec/entities/task";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

import { createEntityNode, hasPlacedEntities } from "./buildUtils";

const FALLBACK = { x: 7, y: 8 };

function placedTask(position: { x: number; y: number }): Task {
  const task = new Task({ $id: "task_1", name: "t", componentRef: {} });
  task.annotations.set(EDITOR_POSITION_ANNOTATION, position);
  return task;
}

describe("createEntityNode", () => {
  it("falls back when the entity was never placed", () => {
    const task = new Task({ $id: "task_1", name: "t", componentRef: {} });

    const node = createEntityNode(task, "task", FALLBACK, {});

    expect(node.position).toEqual(FALLBACK);
  });

  it("reads the position annotation of a placed entity", () => {
    const node = createEntityNode(
      placedTask({ x: 120, y: 240 }),
      "task",
      FALLBACK,
      {},
    );

    expect(node.position).toEqual({ x: 120, y: 240 });
  });

  /**
   * React Flow keeps a node's measured internals while the node object it holds
   * is identical, so a shared position object makes an undone move invisible.
   */
  it("hands out a copy, so a later write cannot reach a built node", () => {
    const task = placedTask({ x: 120, y: 240 });

    const node = createEntityNode(task, "task", FALLBACK, {});
    task.annotations.set(EDITOR_POSITION_ANNOTATION, { x: 500, y: 600 });

    expect(node.position).toEqual({ x: 120, y: 240 });
  });
});

describe("hasPlacedEntities", () => {
  it("is false for a spec nobody ever arranged", () => {
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "p",
      tasks: [new Task({ $id: "task_1", name: "t", componentRef: {} })],
    });

    expect(hasPlacedEntities(spec)).toBe(false);
  });

  it("is true once any task carries a position", () => {
    const spec = new ComponentSpec({
      $id: "spec_2",
      name: "p",
      tasks: [placedTask({ x: 1, y: 2 })],
    });

    expect(hasPlacedEntities(spec)).toBe(true);
  });

  it("is true for a spec placed only through its inputs", () => {
    const input = new Input({ $id: "input_1", name: "N" });
    input.annotations.set(EDITOR_POSITION_ANNOTATION, { x: 0, y: 0 });
    const spec = new ComponentSpec({
      $id: "spec_3",
      name: "p",
      inputs: [input],
    });

    expect(hasPlacedEntities(spec)).toBe(true);
  });
});
