import { describe, expect, it } from "vitest";

import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { Output } from "@/models/componentSpec/entities/output";
import { Task } from "@/models/componentSpec/entities/task";
import {
  propagateInputDelete,
  propagateInputRename,
  propagateOutputDelete,
  propagateOutputRename,
} from "@/routes/v2/pages/Editor/store/actions/io.parentPropagation";
import type { ParentContext } from "@/routes/v2/shared/store/navigationStore";

function buildSubgraphSetup() {
  const subgraphInput = new Input({ $id: "sub_input_1", name: "data" });
  const subgraphOutput = new Output({ $id: "sub_output_1", name: "result" });
  const subgraphSpec = new ComponentSpec({
    $id: "sub_spec",
    name: "SubPipeline",
    inputs: [subgraphInput],
    outputs: [subgraphOutput],
  });

  const parentTask = new Task({
    $id: "task_A",
    name: "SubPipeline",
    componentRef: { name: "SubPipeline" },
    subgraphSpec,
    arguments: [{ name: "data", value: "some_value" }],
  });

  const parentSpec = new ComponentSpec({
    $id: "parent_spec",
    name: "ParentPipeline",
    tasks: [parentTask],
    bindings: [
      new Binding({
        $id: "bind_in",
        sourceEntityId: "parent_input_1",
        sourcePortName: "parent_input_1",
        targetEntityId: "task_A",
        targetPortName: "data",
      }),
      new Binding({
        $id: "bind_out",
        sourceEntityId: "task_A",
        sourcePortName: "result",
        targetEntityId: "parent_output_1",
        targetPortName: "parent_output_1",
      }),
      new Binding({
        $id: "bind_unrelated",
        sourceEntityId: "other_input",
        sourcePortName: "other_input",
        targetEntityId: "other_task",
        targetPortName: "other_port",
      }),
    ],
  });

  const parentContext: ParentContext = {
    parentSpec,
    taskId: "task_A",
  };

  return { subgraphSpec, parentSpec, parentTask, parentContext };
}

describe("propagateInputRename", () => {
  it("updates parent binding targetPortName", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateInputRename(parentContext, "data", "payload");

    const binding = parentSpec.bindings.find((b) => b.$id === "bind_in");
    expect(binding?.targetPortName).toBe("payload");
  });

  it("updates parent task argument name", () => {
    const { parentTask, parentContext } = buildSubgraphSetup();

    propagateInputRename(parentContext, "data", "payload");

    expect(parentTask.arguments.find((a) => a.name === "data")).toBeUndefined();
    const newArg = parentTask.arguments.find((a) => a.name === "payload");
    expect(newArg).toBeDefined();
    expect(newArg?.value).toBe("some_value");
  });

  it("does not affect unrelated bindings", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateInputRename(parentContext, "data", "payload");

    const unrelated = parentSpec.bindings.find(
      (b) => b.$id === "bind_unrelated",
    );
    expect(unrelated?.targetPortName).toBe("other_port");
  });

  it("does not affect output bindings on the same task", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateInputRename(parentContext, "data", "payload");

    const outBinding = parentSpec.bindings.find((b) => b.$id === "bind_out");
    expect(outBinding?.sourcePortName).toBe("result");
  });
});

describe("propagateOutputRename", () => {
  it("updates parent binding sourcePortName", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateOutputRename(parentContext, "result", "output_data");

    const binding = parentSpec.bindings.find((b) => b.$id === "bind_out");
    expect(binding?.sourcePortName).toBe("output_data");
  });

  it("does not affect unrelated bindings", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateOutputRename(parentContext, "result", "output_data");

    const unrelated = parentSpec.bindings.find(
      (b) => b.$id === "bind_unrelated",
    );
    expect(unrelated?.sourcePortName).toBe("other_input");
  });

  it("does not affect input bindings on the same task", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateOutputRename(parentContext, "result", "output_data");

    const inBinding = parentSpec.bindings.find((b) => b.$id === "bind_in");
    expect(inBinding?.targetPortName).toBe("data");
  });
});

describe("propagateInputDelete", () => {
  it("removes parent bindings targeting the deleted input", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateInputDelete(parentContext, "data");

    expect(
      parentSpec.bindings.find((b) => b.$id === "bind_in"),
    ).toBeUndefined();
  });

  it("removes the parent task argument for the deleted input", () => {
    const { parentTask, parentContext } = buildSubgraphSetup();

    propagateInputDelete(parentContext, "data");

    expect(parentTask.arguments.find((a) => a.name === "data")).toBeUndefined();
  });

  it("preserves unrelated bindings and output bindings", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateInputDelete(parentContext, "data");

    expect(parentSpec.bindings.find((b) => b.$id === "bind_out")).toBeDefined();
    expect(
      parentSpec.bindings.find((b) => b.$id === "bind_unrelated"),
    ).toBeDefined();
  });
});

describe("propagateOutputDelete", () => {
  it("removes parent bindings sourcing from the deleted output", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateOutputDelete(parentContext, "result");

    expect(
      parentSpec.bindings.find((b) => b.$id === "bind_out"),
    ).toBeUndefined();
  });

  it("preserves unrelated bindings and input bindings", () => {
    const { parentSpec, parentContext } = buildSubgraphSetup();

    propagateOutputDelete(parentContext, "result");

    expect(parentSpec.bindings.find((b) => b.$id === "bind_in")).toBeDefined();
    expect(
      parentSpec.bindings.find((b) => b.$id === "bind_unrelated"),
    ).toBeDefined();
  });

  it("does not affect parent task arguments", () => {
    const { parentTask, parentContext } = buildSubgraphSetup();

    propagateOutputDelete(parentContext, "result");

    expect(parentTask.arguments.find((a) => a.name === "data")).toBeDefined();
  });
});
