import { describe, expect, it } from "vitest";

import { Binding, ComponentSpec, Input, Task } from "@/models/componentSpec";

import {
  clearConditionalExecution,
  CONDITION_LITERAL_LABELS,
  describeConditionSource,
  IS_ENABLED_PORT_NAME,
  isConditionalArgument,
  isConditionalExecutionSupported,
  isTaskConditional,
  resolveConditionalReference,
  toConditionLiteral,
} from "./conditionalExecution";

function makeTask(id: string, name: string) {
  return new Task({ $id: id, name, componentRef: {} });
}

function makeGraphComponentTask(id: string, name: string) {
  return new Task({
    $id: id,
    name,
    componentRef: { spec: { implementation: { graph: { tasks: {} } } } },
  });
}

function makeEmbeddedSubgraphTask(id: string, name: string) {
  const task = new Task({ $id: id, name, componentRef: {} });
  task.setSubgraphSpec(new ComponentSpec({ $id: "spec_sub", name: "Inner" }));
  return task;
}

function makeSpec(
  tasks: Task[],
  inputs: Input[] = [],
  bindings: Binding[] = [],
) {
  return new ComponentSpec({
    $id: "spec_1",
    name: "Pipeline",
    tasks,
    inputs,
    bindings,
  });
}

function bindToRunCondition(
  sourceEntityId: string,
  sourcePortName: string,
  taskId: string,
) {
  return new Binding({
    $id: "binding_1",
    sourceEntityId,
    sourcePortName,
    targetEntityId: taskId,
    targetPortName: IS_ENABLED_PORT_NAME,
  });
}

describe("toConditionLiteral", () => {
  it("treats anything other than the false literal as always", () => {
    expect(toConditionLiteral(undefined)).toBe("true");
    expect(toConditionLiteral("true")).toBe("true");
    expect(toConditionLiteral({ graphInput: { inputName: "flag" } })).toBe(
      "true",
    );
    expect(toConditionLiteral("false")).toBe("false");
  });

  it("recognises the shapes a hand-authored pipeline can produce", () => {
    expect(toConditionLiteral(false)).toBe("false");
    expect(toConditionLiteral("False")).toBe("false");
    expect(toConditionLiteral("FALSE\n")).toBe("false");
    expect(toConditionLiteral(true)).toBe("true");
    expect(toConditionLiteral("True")).toBe("true");
  });

  it("labels the literals for display", () => {
    expect(CONDITION_LITERAL_LABELS.true).toBe("Always");
    expect(CONDITION_LITERAL_LABELS.false).toBe("Never");
  });
});

describe("isConditionalArgument", () => {
  it("accepts upstream references in both object and template form", () => {
    expect(isConditionalArgument({ graphInput: { inputName: "flag" } })).toBe(
      true,
    );
    expect(
      isConditionalArgument({
        taskOutput: { taskId: "Flag", outputName: "flag" },
      }),
    ).toBe(true);
    expect(isConditionalArgument("{{inputs.flag}}")).toBe(true);
    expect(isConditionalArgument("{{tasks.Flag.outputs.flag}}")).toBe(true);
  });

  it("rejects literals and absent values", () => {
    expect(isConditionalArgument(undefined)).toBe(false);
    expect(isConditionalArgument("false")).toBe(false);
    expect(isConditionalArgument("true")).toBe(false);
  });
});

describe("isTaskConditional", () => {
  it("is false for a task with no run condition", () => {
    const task = makeTask("task_1", "Greet");
    expect(isTaskConditional(task, makeSpec([task]))).toBe(false);
  });

  it("is true for a literal run condition", () => {
    const task = makeTask("task_1", "Greet");
    task.setIsEnabled("false");
    expect(isTaskConditional(task, makeSpec([task]))).toBe(true);
  });

  it("is true for a connected run condition even without a literal", () => {
    const task = makeTask("task_1", "Greet");
    const flag = new Input({ $id: "input_1", name: "run_greeting" });
    const spec = makeSpec(
      [task],
      [flag],
      [bindToRunCondition(flag.$id, "run_greeting", task.$id)],
    );

    expect(task.isEnabled).toBeUndefined();
    expect(isTaskConditional(task, spec)).toBe(true);
  });

  it("ignores bindings to other ports", () => {
    const task = makeTask("task_1", "Greet");
    const flag = new Input({ $id: "input_1", name: "name" });
    const spec = makeSpec(
      [task],
      [flag],
      [
        new Binding({
          $id: "binding_1",
          sourceEntityId: flag.$id,
          sourcePortName: "name",
          targetEntityId: task.$id,
          targetPortName: "name",
        }),
      ],
    );

    expect(isTaskConditional(task, spec)).toBe(false);
  });
});

describe("isConditionalExecutionSupported", () => {
  it("is true for a container-component task", () => {
    expect(isConditionalExecutionSupported(makeTask("task_1", "Greet"))).toBe(
      true,
    );
  });

  it("is false for an embedded subgraph", () => {
    expect(
      isConditionalExecutionSupported(
        makeEmbeddedSubgraphTask("task_1", "Inner"),
      ),
    ).toBe(false);
  });

  it("is false for a referenced graph component", () => {
    expect(
      isConditionalExecutionSupported(
        makeGraphComponentTask("task_1", "Published"),
      ),
    ).toBe(false);
  });
});

describe("clearConditionalExecution", () => {
  it("removes both the literal and the reserved-port binding", () => {
    const task = makeTask("task_1", "Greet");
    task.setIsEnabled("false");
    const flag = new Input({ $id: "input_1", name: "run_greeting" });
    const spec = makeSpec(
      [task],
      [flag],
      [bindToRunCondition(flag.$id, "run_greeting", task.$id)],
    );

    clearConditionalExecution(spec, task);

    expect(task.isEnabled).toBeUndefined();
    expect(isTaskConditional(task, spec)).toBe(false);
    expect(spec.bindings).toHaveLength(0);
  });

  it("leaves bindings to other ports alone", () => {
    const task = makeTask("task_1", "Greet");
    task.setIsEnabled("true");
    const name = new Input({ $id: "input_1", name: "name" });
    const spec = makeSpec(
      [task],
      [name],
      [
        new Binding({
          $id: "binding_1",
          sourceEntityId: name.$id,
          sourcePortName: "name",
          targetEntityId: task.$id,
          targetPortName: "name",
        }),
      ],
    );

    clearConditionalExecution(spec, task);

    expect(task.isEnabled).toBeUndefined();
    expect(spec.bindings).toHaveLength(1);
  });
});

describe("resolveConditionalReference", () => {
  it("resolves a task output source by task name", () => {
    const upstream = makeTask("task_1", "Flag");
    const task = makeTask("task_2", "Greet");
    const spec = makeSpec(
      [upstream, task],
      [],
      [bindToRunCondition(upstream.$id, "flag", task.$id)],
    );

    expect(resolveConditionalReference(task, spec)).toEqual({
      taskOutput: { taskId: "Flag", outputName: "flag" },
    });
  });

  it("resolves a graph input source by input name", () => {
    const task = makeTask("task_1", "Greet");
    const flag = new Input({ $id: "input_1", name: "run_greeting" });
    const spec = makeSpec(
      [task],
      [flag],
      [bindToRunCondition(flag.$id, "run_greeting", task.$id)],
    );

    expect(resolveConditionalReference(task, spec)).toEqual({
      graphInput: { inputName: "run_greeting" },
    });
  });

  it("is undefined when the run condition is a literal", () => {
    const task = makeTask("task_1", "Greet");
    task.setIsEnabled("false");

    expect(resolveConditionalReference(task, makeSpec([task]))).toBeUndefined();
  });
});

describe("describeConditionSource", () => {
  it("matches the arrow form the node card uses for bound inputs", () => {
    expect(
      describeConditionSource({
        taskOutput: { taskId: "Flag", outputName: "flag" },
      }),
    ).toBe("→ Flag.flag");
    expect(
      describeConditionSource({ graphInput: { inputName: "run_greeting" } }),
    ).toBe("→ run_greeting");
  });

  it("describes the template form an unresolved reference keeps", () => {
    expect(describeConditionSource("{{inputs.run_greeting}}")).toBe(
      "→ run_greeting",
    );
    expect(describeConditionSource("{{tasks.Flag.outputs.flag}}")).toBe(
      "→ Flag.flag",
    );
  });

  it("is undefined for literals and absent references", () => {
    expect(describeConditionSource(undefined)).toBeUndefined();
    expect(describeConditionSource("false")).toBeUndefined();
  });
});
