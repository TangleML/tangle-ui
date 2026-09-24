import { describe, expect, it } from "vitest";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";
import {
  EDITOR_POSITION_ANNOTATION,
  FLEX_NODES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotationKeys";
import { PROVISIONAL_NAME_ANNOTATION } from "@/utils/annotationKeys";

import { serializeSpecForAi } from "./serializeSpecForAi";

function stickyNote(overrides: Partial<FlexNodeData> = {}): FlexNodeData {
  return {
    id: "flex_1",
    properties: {
      title: "Careful",
      content: "Tuned by hand",
      color: "#FFF9C4",
    },
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", createdBy: "user" },
    size: { width: 150, height: 100 },
    position: { x: 40, y: 80 },
    zIndex: 0,
    ...overrides,
  };
}

function buildBasicSpec(): ComponentSpec {
  const spec = new ComponentSpec({ $id: "spec_1", name: "MyPipeline" });
  spec.setDescription("Loads data and transforms it.");

  spec.addInput(
    new Input({
      $id: "in_1",
      name: "raw_path",
      type: "String",
      description: "Path to the raw file",
      defaultValue: "data.csv",
      optional: false,
    }),
  );
  spec.addInput(new Input({ $id: "in_2", name: "rows", type: "Integer" }));

  spec.addOutput(
    new Output({
      $id: "out_1",
      name: "result",
      type: "String",
      description: "Final artifact path",
    }),
  );

  spec.addTask(
    new Task({
      $id: "task_1",
      name: "Load",
      componentRef: {
        name: "load",
        url: "https://example.com/load.yaml",
        spec: {
          name: "Load",
          inputs: [{ name: "path", type: "String" }],
          outputs: [{ name: "table", type: "String" }],
          implementation: { container: { image: "loader:1" } },
        },
      },
      arguments: [{ name: "path", value: "data.csv" }],
    }),
  );

  spec.addBinding(
    new Binding({
      $id: "bind_1",
      sourceEntityId: "in_1",
      sourcePortName: "in_1",
      targetEntityId: "task_1",
      targetPortName: "path",
    }),
  );

  return spec;
}

describe("serializeSpecForAi", () => {
  it("serializes pipeline name and description", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec);

    expect(ai.name).toBe("MyPipeline");
    expect(ai.description).toBe("Loads data and transforms it.");
  });

  it("omits optional fields when empty", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Empty" });
    const ai = serializeSpecForAi(spec);

    expect(ai.description).toBeUndefined();
    expect(ai.activeSubgraphPath).toBeUndefined();
    expect(ai.inputs).toEqual([]);
    expect(ai.outputs).toEqual([]);
    expect(ai.tasks).toEqual([]);
    expect(ai.bindings).toEqual([]);
  });

  it("serializes inputs with all optional fields when present", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec);

    expect(ai.inputs).toHaveLength(2);
    expect(ai.inputs[0]).toEqual({
      $id: "in_1",
      name: "raw_path",
      type: "String",
      description: "Path to the raw file",
      default: "data.csv",
      optional: false,
      position: { x: -200, y: 0 },
    });
    expect(ai.inputs[1]).toEqual({
      $id: "in_2",
      name: "rows",
      type: "Integer",
      position: { x: -200, y: 150 },
    });
  });

  it("serializes outputs with optional fields omitted when missing", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec);

    expect(ai.outputs).toEqual([
      {
        $id: "out_1",
        name: "result",
        type: "String",
        description: "Final artifact path",
        position: { x: 800, y: 0 },
      },
    ]);
  });

  it("serializes tasks with componentRef, arguments, and isSubgraph flag", () => {
    const spec = buildBasicSpec();
    spec.addTask(
      new Task({
        $id: "task_2",
        name: "Sub",
        componentRef: {
          name: "sub",
          spec: {
            name: "Sub",
            implementation: { graph: { tasks: {} } },
          },
        },
      }),
    );

    const ai = serializeSpecForAi(spec);
    expect(ai.tasks).toHaveLength(2);
    expect(ai.tasks[0]).toEqual({
      $id: "task_1",
      name: "Load",
      componentRef: {
        name: "load",
        url: "https://example.com/load.yaml",
        spec: {
          name: "Load",
          inputs: [{ name: "path", type: "String" }],
          outputs: [{ name: "table", type: "String" }],
          implementation: "container",
        },
      },
      arguments: [{ name: "path", value: "data.csv" }],
      position: { x: 200, y: 0 },
    });
    expect(ai.tasks[1].isSubgraph).toBe(true);
    expect(ai.tasks[1].componentRef.spec?.implementation).toBe("graph");
  });

  /** A task whose component cannot run otherwise reads like one that can. */
  it("says when a component has no implementation", () => {
    const spec = new ComponentSpec({ $id: "spec_2", name: "Greeter" });
    spec.addTask(
      new Task({
        $id: "task_1",
        name: "greet",
        componentRef: {
          name: "Hello greeting",
          spec: {
            name: "Hello greeting",
            inputs: [{ name: "name", type: "String" }],
            outputs: [{ name: "greeting", type: "String" }],
            // The shape an agent authoring a component inline produces, and
            // the one nothing downstream can run.
          } as unknown as NonNullable<
            ConstructorParameters<typeof Task>[0]["componentRef"]
          >["spec"],
        },
      }),
    );

    const ai = serializeSpecForAi(spec);

    expect(ai.tasks[0].componentRef.spec?.implementation).toBe("missing");
  });

  it("serializes bindings", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec);

    expect(ai.bindings).toEqual([
      {
        $id: "bind_1",
        sourceEntityId: "in_1",
        sourcePortName: "in_1",
        targetEntityId: "task_1",
        targetPortName: "path",
      },
    ]);
  });

  it("surfaces activeSubgraphPath when provided", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec, {
      activeSubgraphPath: ["preprocess", "split"],
    });

    expect(ai.activeSubgraphPath).toEqual(["preprocess", "split"]);
  });

  it("omits activeSubgraphPath when empty array passed", () => {
    const spec = buildBasicSpec();
    const ai = serializeSpecForAi(spec, { activeSubgraphPath: [] });

    expect(ai.activeSubgraphPath).toBeUndefined();
  });

  it("serializes the stored position of a node the user has placed", () => {
    const spec = buildBasicSpec();
    spec.tasks[0]?.annotations.set(EDITOR_POSITION_ANNOTATION, {
      x: 120,
      y: 340,
    });

    const ai = serializeSpecForAi(spec);

    expect(ai.tasks[0]?.position).toEqual({ x: 120, y: 340 });
  });

  it("reports where an unplaced node renders rather than nothing at all", () => {
    const ai = serializeSpecForAi(buildBasicSpec());

    expect(ai.tasks[0]?.position).toEqual({ x: 200, y: 0 });
    expect(ai.inputs[0]?.position).toEqual({ x: -200, y: 0 });
    expect(ai.inputs[1]?.position).toEqual({ x: -200, y: 150 });
    expect(ai.outputs[0]?.position).toEqual({ x: 800, y: 0 });
  });

  it("omits stickyNotes when the canvas has none", () => {
    const ai = serializeSpecForAi(buildBasicSpec());

    expect(ai.stickyNotes).toBeUndefined();
  });

  it("serializes sticky notes with their content, colours and layout", () => {
    const spec = buildBasicSpec();
    spec.annotations.set(FLEX_NODES_ANNOTATION, [
      stickyNote({
        properties: {
          title: "Careful",
          content: "Tuned by hand",
          color: "transparent",
          borderColor: "#BCBCBC",
        },
        size: { width: 260, height: 120 },
        locked: true,
      }),
    ]);

    const ai = serializeSpecForAi(spec);

    expect(ai.stickyNotes).toEqual([
      {
        id: "flex_1",
        title: "Careful",
        content: "Tuned by hand",
        color: "transparent",
        borderColor: "#BCBCBC",
        position: { x: 40, y: 80 },
        size: { width: 260, height: 120 },
        locked: true,
        createdBy: "user",
      },
    ]);
  });

  it("omits empty note text but keeps createdBy so authorship stays visible", () => {
    const spec = buildBasicSpec();
    spec.annotations.set(FLEX_NODES_ANNOTATION, [
      stickyNote({
        properties: { title: "", content: "", color: "#FFF9C4" },
        metadata: {
          createdAt: "2026-01-01T00:00:00.000Z",
          createdBy: "AI assistant",
        },
      }),
    ]);

    const [note] = serializeSpecForAi(spec).stickyNotes ?? [];

    expect(note?.title).toBeUndefined();
    expect(note?.content).toBeUndefined();
    expect(note?.createdBy).toBe("AI assistant");
  });

  describe("structured-clone safety", () => {
    it("survives the Comlink hop with observable-backed values throughout", () => {
      const spec = new ComponentSpec({ $id: "spec_1", name: "Leaky" });
      spec.addInput(
        new Input({
          $id: "in_1",
          name: "cfg",
          type: { JsonObject: { schema: "x" } },
        }),
      );
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "Fetch",
          componentRef: {
            name: "Fetch",
            spec: {
              name: "Fetch",
              inputs: [{ name: "token", type: { JsonObject: { a: "b" } } }],
              implementation: { container: { image: "fetch:1" } },
            },
          },
          arguments: [
            {
              name: "token",
              value: { dynamicData: { secret: { name: "k" } } },
            },
          ],
        }),
      );
      spec.annotations.set(FLEX_NODES_ANNOTATION, [stickyNote()]);
      spec.annotations.set(PIPELINE_TAGS_ANNOTATION, ["nightly", "etl"]);

      expect(() => structuredClone(serializeSpecForAi(spec))).not.toThrow();
    });
  });

  /** The editor agent renames a placeholder and leaves a chosen name alone. */
  it("tells the agent when the name is a placeholder nobody chose", () => {
    const spec = buildBasicSpec();
    spec.annotations.set(PROVISIONAL_NAME_ANNOTATION, "true");

    expect(serializeSpecForAi(spec).nameIsProvisional).toBe(true);
  });

  it("says nothing about a name someone chose", () => {
    expect(
      serializeSpecForAi(buildBasicSpec()).nameIsProvisional,
    ).toBeUndefined();
  });
});
