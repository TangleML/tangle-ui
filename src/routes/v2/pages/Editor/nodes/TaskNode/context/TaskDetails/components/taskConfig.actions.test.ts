import { describe, expect, it } from "vitest";

import { Binding, ComponentSpec, Input, Task } from "@/models/componentSpec";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import { setConditionalExecution, setRunCondition } from "./taskConfig.actions";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

function makeSpecWithTask() {
  const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
  const spec = new ComponentSpec({
    $id: "spec_1",
    name: "Pipeline",
    tasks: [task],
  });
  return { spec, task };
}

describe("setConditionalExecution", () => {
  it("enabling defaults the run condition to the always literal", () => {
    const { spec, task } = makeSpecWithTask();

    setConditionalExecution(noopUndo, spec, task, true);

    expect(task.isEnabled).toBe("true");
  });

  it("disabling clears both the literal and any connected condition", () => {
    const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
    const flag = new Input({ $id: "input_1", name: "run_greeting" });
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [task],
      inputs: [flag],
      bindings: [
        new Binding({
          $id: "binding_1",
          sourceEntityId: flag.$id,
          sourcePortName: "run_greeting",
          targetEntityId: task.$id,
          targetPortName: IS_ENABLED_PORT_NAME,
        }),
      ],
    });

    setConditionalExecution(noopUndo, spec, task, false);

    expect(task.isEnabled).toBeUndefined();
    expect(spec.bindings).toHaveLength(0);
  });

  it("leaves other bindings of the same task alone", () => {
    const task = new Task({ $id: "task_1", name: "Greet", componentRef: {} });
    const name = new Input({ $id: "input_1", name: "name" });
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [task],
      inputs: [name],
      bindings: [
        new Binding({
          $id: "binding_1",
          sourceEntityId: name.$id,
          sourcePortName: "name",
          targetEntityId: task.$id,
          targetPortName: "name",
        }),
      ],
    });

    setConditionalExecution(noopUndo, spec, task, false);

    expect(spec.bindings).toHaveLength(1);
  });

  it("groups the change for undo", () => {
    const labels: string[] = [];
    const undo = {
      withGroup: <T>(label: string, fn: () => T): T => {
        labels.push(label);
        return fn();
      },
    };
    const { spec, task } = makeSpecWithTask();

    setConditionalExecution(undo, spec, task, true);

    expect(labels).toEqual(["Toggle conditional execution"]);
  });
});

describe("setRunCondition", () => {
  it("writes the chosen literal", () => {
    const { task } = makeSpecWithTask();

    setRunCondition(noopUndo, task, "false");
    expect(task.isEnabled).toBe("false");

    setRunCondition(noopUndo, task, "true");
    expect(task.isEnabled).toBe("true");
  });
});
