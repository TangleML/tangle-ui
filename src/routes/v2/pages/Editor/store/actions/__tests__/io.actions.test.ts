import { describe, expect, it } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";
import { createConnectedIONode } from "@/routes/v2/pages/Editor/store/actions/io.actions";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

const position = { x: 0, y: 0 };

function makeSpecWithTask() {
  const task = new Task({
    $id: "task_1",
    name: "Greet",
    componentRef: {
      spec: {
        name: "Say hello",
        inputs: [{ name: "name", type: "String" }],
        implementation: { container: { image: "alpine" } },
      },
    },
  });
  const spec = new ComponentSpec({
    $id: "spec_1",
    name: "Pipeline",
    tasks: [task],
  });
  return { spec, task };
}

describe("createConnectedIONode", () => {
  it("names a graph input after the port it was dragged from", () => {
    const { spec } = makeSpecWithTask();

    createConnectedIONode(
      noopUndo,
      spec,
      "task_1",
      "input_name",
      position,
      "input",
    );

    expect(spec.inputs.map((i) => i.name)).toEqual(["name"]);
    expect(spec.inputs[0].type).toBe("String");
  });

  it("gives the run condition port a readable input name instead of the sentinel", () => {
    const { spec } = makeSpecWithTask();

    createConnectedIONode(
      noopUndo,
      spec,
      "task_1",
      `input_${IS_ENABLED_PORT_NAME}`,
      position,
      "input",
    );

    expect(spec.inputs.map((i) => i.name)).toEqual(["run_condition"]);
    expect(spec.inputs[0].type).toBe("String");
    expect(spec.bindings).toHaveLength(1);
    expect(spec.bindings[0].targetPortName).toBe(IS_ENABLED_PORT_NAME);
  });

  it("carries a Never condition onto the input it creates", () => {
    const { spec, task } = makeSpecWithTask();
    task.setIsEnabled("false");

    createConnectedIONode(
      noopUndo,
      spec,
      "task_1",
      `input_${IS_ENABLED_PORT_NAME}`,
      position,
      "input",
    );

    expect(spec.inputs[0].defaultValue).toBe("false");
  });

  it("gives the input a condition even when the task was set to Always", () => {
    const { spec, task } = makeSpecWithTask();
    task.setIsEnabled("true");

    createConnectedIONode(
      noopUndo,
      spec,
      "task_1",
      `input_${IS_ENABLED_PORT_NAME}`,
      position,
      "input",
    );

    expect(spec.inputs[0].defaultValue).toBe("true");
  });
});
