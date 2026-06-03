import { describe, expect, it } from "vitest";

import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";

import { serializeSpecForAi } from "./serializeSpecForAi";

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
    });
    expect(ai.inputs[1]).toEqual({
      $id: "in_2",
      name: "rows",
      type: "Integer",
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
        },
      },
      arguments: [{ name: "path", value: "data.csv" }],
    });
    expect(ai.tasks[1].isSubgraph).toBe(true);
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
});
