import { describe, expect, it } from "vitest";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  serializeComponentSpecToText,
  Task,
} from "@/models/componentSpec";
import type { EdgeConduit } from "@/models/componentSpec/annotations";
import {
  EDGE_CONDUITS_ANNOTATION,
  EDITOR_POSITION_ANNOTATION,
  FLEX_NODES_ANNOTATION,
} from "@/utils/annotationKeys";

import { getAutoSaveSnapshot } from "./autoSaveSnapshot";

function setup() {
  const task = new Task({ name: "Task", componentRef: {} });
  const input = new Input({ name: "Input" });
  const output = new Output({ name: "Output" });
  const spec = new ComponentSpec({
    name: "Pipeline",
    tasks: [task],
    inputs: [input],
    outputs: [output],
  });
  return { spec, task, input, output };
}

function flexNode(): FlexNodeData {
  return {
    id: "note",
    properties: { title: "Note", content: "Contents", color: "yellow" },
    metadata: { createdAt: "2026-09-22", createdBy: "user" },
    size: { width: 200, height: 100 },
    position: { x: 0, y: 0 },
    zIndex: 0,
  };
}

function conduit(): EdgeConduit {
  return {
    id: "conduit",
    orientation: "horizontal",
    coordinate: 0,
    color: "green",
    edgeIds: ["binding"],
  };
}

describe("getAutoSaveSnapshot", () => {
  it.each(["task", "input", "output"] as const)(
    "ignores %s position changes without changing the model or saved YAML",
    (kind) => {
      const context = setup();
      const { spec } = context;
      const node = context[kind];
      const initial = getAutoSaveSnapshot(spec);

      for (const position of [
        { x: 10, y: 20 },
        { x: -50, y: 100 },
      ]) {
        spec.updateNodePosition(node.$id, position);
        const snapshot = getAutoSaveSnapshot(spec);
        expect(snapshot.contentKey).toBe(initial.contentKey);
        expect(snapshot.yaml).not.toBe(initial.yaml);
        expect(snapshot.yaml).toBe(serializeComponentSpecToText(spec));
        expect(node.annotations.get(EDITOR_POSITION_ANNOTATION)).toEqual(
          position,
        );
      }

      node.annotations.remove(EDITOR_POSITION_ANNOTATION);
      expect(getAutoSaveSnapshot(spec)).toEqual(initial);
    },
  );

  it("ignores nested subgraph positions but retains nested argument edits", () => {
    const { spec, task } = setup();
    const nested = setup();
    task.setSubgraphSpec(nested.spec);
    const initial = getAutoSaveSnapshot(spec);

    nested.spec.updateNodePosition(nested.task.$id, { x: 100, y: 200 });
    nested.spec.updateNodePosition(nested.input.$id, { x: 300, y: 400 });
    nested.spec.updateNodePosition(nested.output.$id, { x: 500, y: 600 });
    expect(getAutoSaveSnapshot(spec).contentKey).toBe(initial.contentKey);
    expect(getAutoSaveSnapshot(spec).yaml).not.toBe(initial.yaml);

    nested.task.setArgument("value", "changed");
    expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
  });

  it.each([
    (context: ReturnType<typeof setup>) => context.spec.setName("Renamed"),
    (context: ReturnType<typeof setup>) =>
      context.spec.setDescription("Description"),
    (context: ReturnType<typeof setup>) => context.task.setName("Renamed"),
    (context: ReturnType<typeof setup>) =>
      context.task.setArgument("value", "changed"),
    (context: ReturnType<typeof setup>) => context.task.setIsEnabled("false"),
    (context: ReturnType<typeof setup>) => context.task.setCacheStaleness("1h"),
    (context: ReturnType<typeof setup>) => context.input.setValue("changed"),
    (context: ReturnType<typeof setup>) => context.output.setName("Renamed"),
    (context: ReturnType<typeof setup>) =>
      context.task.annotations.set("notes", "changed"),
    (context: ReturnType<typeof setup>) =>
      context.spec.annotations.set("custom", { position: { x: 1, y: 2 } }),
    (context: ReturnType<typeof setup>) =>
      context.spec.addTask(new Task({ name: "New", componentRef: {} })),
    (context: ReturnType<typeof setup>) => context.spec.removeTask(0),
    (context: ReturnType<typeof setup>) =>
      context.spec.addInput(new Input({ name: "New" })),
    (context: ReturnType<typeof setup>) => context.spec.removeInput(0),
    (context: ReturnType<typeof setup>) =>
      context.spec.addOutput(new Output({ name: "New" })),
    (context: ReturnType<typeof setup>) => context.spec.removeOutput(0),
    ({ spec, input, task }: ReturnType<typeof setup>) =>
      spec.addBinding(
        new Binding({
          sourceEntityId: input.$id,
          sourcePortName: input.name,
          targetEntityId: task.$id,
          targetPortName: "value",
        }),
      ),
  ])("retains content change %#", (change) => {
    const context = setup();
    const initial = getAutoSaveSnapshot(context.spec);
    change(context);
    expect(getAutoSaveSnapshot(context.spec).contentKey).not.toBe(
      initial.contentKey,
    );
  });

  it("ignores only the position of existing flex nodes", () => {
    const { spec } = setup();
    const node = flexNode();
    spec.annotations.set(FLEX_NODES_ANNOTATION, [node]);
    const initial = getAutoSaveSnapshot(spec);
    spec.annotations.set(FLEX_NODES_ANNOTATION, [
      { ...node, position: { x: 100, y: 200 } },
    ]);
    expect(getAutoSaveSnapshot(spec).contentKey).toBe(initial.contentKey);
    expect(getAutoSaveSnapshot(spec).yaml).not.toBe(initial.yaml);
    expect(spec.annotations.get(FLEX_NODES_ANNOTATION)[0].position).toEqual({
      x: 100,
      y: 200,
    });
  });

  it.each([
    { properties: { ...flexNode().properties, content: "Changed" } },
    { properties: { ...flexNode().properties, color: "green" } },
    { size: { width: 400, height: 200 } },
    { zIndex: 10 },
    { locked: true },
  ])("retains flex node content and appearance changes %j", (change) => {
    const { spec } = setup();
    const node = flexNode();
    spec.annotations.set(FLEX_NODES_ANNOTATION, [node]);
    const initial = getAutoSaveSnapshot(spec);
    spec.annotations.set(FLEX_NODES_ANNOTATION, [{ ...node, ...change }]);
    expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
  });

  it("ignores only the coordinate of existing conduits", () => {
    const { spec } = setup();
    const node = conduit();
    spec.annotations.set(EDGE_CONDUITS_ANNOTATION, [node]);
    const initial = getAutoSaveSnapshot(spec);
    spec.annotations.set(EDGE_CONDUITS_ANNOTATION, [
      { ...node, coordinate: 500 },
    ]);
    expect(getAutoSaveSnapshot(spec).contentKey).toBe(initial.contentKey);
    expect(getAutoSaveSnapshot(spec).yaml).not.toBe(initial.yaml);
    expect(spec.annotations.get(EDGE_CONDUITS_ANNOTATION)[0].coordinate).toBe(
      500,
    );
  });

  it.each<Partial<EdgeConduit>>([
    { orientation: "vertical" },
    { color: "red" },
    { edgeIds: ["other-binding"] },
  ])("retains conduit content changes %j", (change) => {
    const { spec } = setup();
    const node = conduit();
    spec.annotations.set(EDGE_CONDUITS_ANNOTATION, [node]);
    const initial = getAutoSaveSnapshot(spec);
    spec.annotations.set(EDGE_CONDUITS_ANNOTATION, [{ ...node, ...change }]);
    expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
  });

  it.each([FLEX_NODES_ANNOTATION, EDGE_CONDUITS_ANNOTATION])(
    "retains node additions and removals in %s",
    (key) => {
      const { spec } = setup();
      const node = key === FLEX_NODES_ANNOTATION ? flexNode() : conduit();
      spec.setMetadata(key, [node]);
      const initial = getAutoSaveSnapshot(spec);
      spec.setMetadata(key, [node, { ...node, id: "second" }]);
      expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
      spec.setMetadata(key, []);
      expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
    },
  );

  it("preserves malformed layout annotations in embedded component references", () => {
    const { spec, task } = setup();
    const nested = {
      implementation: { container: { image: "alpine" } },
      metadata: {
        annotations: {
          [FLEX_NODES_ANNOTATION]: "not json",
          [EDGE_CONDUITS_ANNOTATION]: '[{"coordinate":1}]',
        },
      },
    };
    task.setComponentRef({ spec: nested });
    const initial = getAutoSaveSnapshot(spec);
    expect(initial.contentKey).toContain("not json");
    expect(initial.contentKey).toContain('\\"coordinate\\":1');
    task.setComponentRef({
      spec: {
        ...nested,
        metadata: {
          annotations: {
            [FLEX_NODES_ANNOTATION]: "still not json",
            [EDGE_CONDUITS_ANNOTATION]: '[{"coordinate":2}]',
          },
        },
      },
    });
    expect(getAutoSaveSnapshot(spec).contentKey).not.toBe(initial.contentKey);
  });
});
