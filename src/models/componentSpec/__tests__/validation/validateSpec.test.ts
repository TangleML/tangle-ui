import { describe, expect, it } from "vitest";

import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";
import type { ComponentSpecJson, TypeSpecType } from "../../entities/types";
import { validateSpec } from "../../validation/validateSpec";

function makeSpec(name = "TestPipeline"): ComponentSpec {
  return new ComponentSpec({ $id: "spec_1", name });
}

const containerComponentSpec: ComponentSpecJson = {
  implementation: { container: { image: "python:3.11" } },
};

function makeTask(id: string, name: string, spec?: ComponentSpecJson): Task {
  return new Task({
    $id: id,
    name,
    componentRef: { name: `component-${name}`, spec },
  });
}

function makeInput(id: string, name: string, optional?: boolean): Input {
  return new Input({ $id: id, name, optional });
}

function makeOutput(id: string, name: string): Output {
  return new Output({ $id: id, name });
}

function makeBinding(
  id: string,
  sourceEntityId: string,
  sourcePortName: string,
  targetEntityId: string,
  targetPortName: string,
): Binding {
  return new Binding({
    $id: id,
    sourceEntityId,
    sourcePortName,
    targetEntityId,
    targetPortName,
  });
}

describe("validateSpec", () => {
  describe("graph-level rules", () => {
    it("reports error when component name is empty", () => {
      const spec = makeSpec("");
      spec.addTask(makeTask("t1", "TaskA"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "graph",
          message: "Component name is required and cannot be empty",
          severity: "error",
        }),
      );
    });

    it("reports error when pipeline has no tasks", () => {
      const spec = makeSpec("MyPipeline");

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "graph",
          message: "Pipeline must contain at least one task",
          severity: "error",
        }),
      );
    });

    it("returns no graph-level errors for a valid pipeline", () => {
      const spec = makeSpec("ValidPipeline");
      spec.addTask(makeTask("t1", "TaskA"));

      const issues = validateSpec(spec);
      const graphIssues = issues.filter((i) => i.type === "graph");

      expect(graphIssues).toHaveLength(0);
    });
  });

  describe("input rules", () => {
    it("reports error when input name is empty", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(makeInput("i1", ""));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "input",
          message: "Input must have a valid name",
          entityId: "i1",
          severity: "error",
        }),
      );
    });

    it("reports error for duplicate input names", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(makeInput("i1", "data"));
      spec.addInput(makeInput("i2", "data"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "input",
          message: 'Duplicate input name: "data"',
          entityId: "i2",
          severity: "error",
        }),
      );
    });

    it("reports warning when input is not connected to any task", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(makeInput("i1", "data"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "input",
          message: "Not connected to any tasks",
          entityId: "i1",
          severity: "warning",
        }),
      );
    });

    it("does not report unconnected input when bound to a task", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "TaskA");
      const input = makeInput("i1", "data");
      spec.addTask(task);
      spec.addInput(input);
      spec.addBinding(makeBinding("b1", "i1", "data", "t1", "data"));

      const issues = validateSpec(spec);
      const unconnectedInputs = issues.filter(
        (i) => i.type === "input" && i.message === "Not connected to any tasks",
      );

      expect(unconnectedInputs).toHaveLength(0);
    });

    it("does not report unconnected input when referenced by graphInput argument", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "TaskA");
      task.setArgument("data", {
        graphInput: { inputName: "myInput" },
      });
      const input = makeInput("i1", "myInput");
      spec.addTask(task);
      spec.addInput(input);

      const issues = validateSpec(spec);
      const unconnectedInputs = issues.filter(
        (i) => i.type === "input" && i.message === "Not connected to any tasks",
      );

      expect(unconnectedInputs).toHaveLength(0);
    });

    it("reports warning when required pipeline input has no default or value (root only)", () => {
      const spec = makeSpec("Pipeline");
      spec.addTask(makeTask("t1", "TaskA"));
      const input = new Input({
        $id: "i1",
        name: "param",
        optional: false,
      });
      spec.addInput(input);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "input",
          message: "Required input missing value",
          entityId: "i1",
          severity: "warning",
          issueCode: "MISSING_PIPELINE_INPUT_VALUE",
          argumentName: "param",
        }),
      );
    });

    it("does not report missing pipeline input value when defaultValue is set", () => {
      const spec = makeSpec("Pipeline");
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(
        new Input({
          $id: "i1",
          name: "param",
          optional: false,
          defaultValue: "x",
        }),
      );

      const issues = validateSpec(spec).filter(
        (i) => i.issueCode === "MISSING_PIPELINE_INPUT_VALUE",
      );
      expect(issues).toHaveLength(0);
    });

    it("does not report missing pipeline input value when value is set", () => {
      const spec = makeSpec("Pipeline");
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(
        new Input({
          $id: "i1",
          name: "param",
          optional: false,
          value: "42",
        }),
      );

      const issues = validateSpec(spec).filter(
        (i) => i.issueCode === "MISSING_PIPELINE_INPUT_VALUE",
      );
      expect(issues).toHaveLength(0);
    });

    it("does not report missing pipeline input value when input is optional", () => {
      const spec = makeSpec("Pipeline");
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(makeInput("i1", "param", true));

      const issues = validateSpec(spec).filter(
        (i) => i.issueCode === "MISSING_PIPELINE_INPUT_VALUE",
      );
      expect(issues).toHaveLength(0);
    });

    it("skips pipeline input value warnings for embedded subgraph specs", () => {
      const spec = new ComponentSpec({
        $id: "spec_embed",
        name: "Inner",
        isEmbeddedSubgraph: true,
      });
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addInput(new Input({ $id: "i1", name: "p", optional: false }));

      const issues = validateSpec(spec).filter(
        (i) => i.issueCode === "MISSING_PIPELINE_INPUT_VALUE",
      );
      expect(issues).toHaveLength(0);
    });
  });

  describe("output rules", () => {
    it("reports error when output name is empty", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addOutput(makeOutput("o1", ""));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "output",
          message: "Output must have a valid name",
          entityId: "o1",
          severity: "error",
        }),
      );
    });

    it("reports error for duplicate output names", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addOutput(makeOutput("o1", "result"));
      spec.addOutput(makeOutput("o2", "result"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "output",
          message: 'Duplicate output name: "result"',
          entityId: "o2",
          severity: "error",
        }),
      );
    });

    it("reports warning when output is not connected to any task", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addOutput(makeOutput("o1", "result"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "output",
          message: "Not connected to any tasks",
          entityId: "o1",
          severity: "warning",
        }),
      );
    });

    it("does not report unconnected output when bound from a task", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addOutput(makeOutput("o1", "result"));
      spec.addBinding(makeBinding("b1", "t1", "output", "o1", "result"));

      const issues = validateSpec(spec);
      const unconnectedOutputs = issues.filter(
        (i) =>
          i.type === "output" && i.message === "Not connected to any tasks",
      );

      expect(unconnectedOutputs).toHaveLength(0);
    });
  });

  describe("task rules", () => {
    it("reports error when task name is empty", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", ""));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: "Task name cannot be empty",
          entityId: "t1",
          severity: "error",
        }),
      );
    });

    it("reports error when task has no component reference name or url", () => {
      const spec = makeSpec();
      const task = new Task({
        $id: "t1",
        name: "TaskA",
        componentRef: {},
      });
      spec.addTask(task);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: "Missing component reference",
          entityId: "t1",
          severity: "error",
        }),
      );
    });

    it("reports error when task argument references non-existent input", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "TaskA");
      task.setArgument("param", {
        graphInput: { inputName: "nonExistent" },
      });
      spec.addTask(task);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message:
            'Argument "param" references non-existent input: "nonExistent"',
          entityId: "t1",
          severity: "error",
        }),
      );
    });

    it("reports error when task argument references non-existent task", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "TaskA");
      task.setArgument("data", {
        taskOutput: { taskId: "MissingTask", outputName: "result" },
      });
      spec.addTask(task);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message:
            'Argument "data" references non-existent task: "MissingTask"',
          entityId: "t1",
          severity: "error",
        }),
      );
    });

    it("reports error for missing required task input (no binding or argument)", () => {
      const taskComponentSpec: ComponentSpecJson = {
        name: "SomeComponent",
        inputs: [
          { name: "requiredInput", optional: false },
          { name: "optionalInput", optional: true },
        ],
        implementation: { container: { image: "test" } },
      };

      const spec = makeSpec();
      const task = makeTask("t1", "TaskA", taskComponentSpec);
      spec.addTask(task);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: 'Missing required input "requiredInput"',
          entityId: "t1",
          severity: "error",
        }),
      );

      const optionalMissing = issues.find((i) =>
        i.message.includes("optionalInput"),
      );
      expect(optionalMissing).toBeUndefined();
    });

    it("does not report missing input when satisfied by binding", () => {
      const taskComponentSpec: ComponentSpecJson = {
        name: "SomeComponent",
        inputs: [{ name: "requiredInput", optional: false }],
        implementation: { container: { image: "test" } },
      };

      const spec = makeSpec();
      const input = makeInput("i1", "source");
      const task = makeTask("t1", "TaskA", taskComponentSpec);
      spec.addInput(input);
      spec.addTask(task);
      spec.addBinding(makeBinding("b1", "i1", "source", "t1", "requiredInput"));

      const issues = validateSpec(spec);

      const missingInput = issues.find((i) =>
        i.message.includes("requiredInput"),
      );
      expect(missingInput).toBeUndefined();
    });

    it("does not report missing input when satisfied by argument", () => {
      const taskComponentSpec: ComponentSpecJson = {
        name: "SomeComponent",
        inputs: [{ name: "requiredInput", optional: false }],
        implementation: { container: { image: "test" } },
      };

      const spec = makeSpec();
      const task = makeTask("t1", "TaskA", taskComponentSpec);
      task.setArgument("requiredInput", "some-value");
      spec.addTask(task);

      const issues = validateSpec(spec);

      const missingInput = issues.find((i) =>
        i.message.includes("requiredInput"),
      );
      expect(missingInput).toBeUndefined();
    });

    it("does not report missing input when component input has a default", () => {
      const taskComponentSpec: ComponentSpecJson = {
        name: "SomeComponent",
        inputs: [
          { name: "requiredInput", optional: false, default: "fallback" },
        ],
        implementation: { container: { image: "test" } },
      };

      const spec = makeSpec();
      const task = makeTask("t1", "TaskA", taskComponentSpec);
      spec.addTask(task);

      const issues = validateSpec(spec);

      const missingInput = issues.find((i) =>
        i.message.includes("requiredInput"),
      );
      expect(missingInput).toBeUndefined();
    });
  });

  describe("conditional execution rules", () => {
    const graphComponentSpec: ComponentSpecJson = {
      implementation: { graph: { tasks: {} } },
    };

    const conditionalIssues = (spec: ComponentSpec) =>
      validateSpec(spec).filter(
        (i) => i.issueCode === "CONDITIONAL_EXECUTION_UNSUPPORTED",
      );

    it("reports error for a subgraph gated on a literal", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Inner", graphComponentSpec);
      task.setIsEnabled("false");
      spec.addTask(task);

      expect(conditionalIssues(spec)).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: "Conditional execution is not supported on subgraphs",
          entityId: "t1",
          severity: "error",
        }),
      );
    });

    it("reports error for a subgraph gated on a connected condition", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Flag"));
      spec.addTask(makeTask("t2", "Inner", graphComponentSpec));
      spec.addBinding(
        makeBinding("b1", "t1", "flag", "t2", IS_ENABLED_PORT_NAME),
      );

      expect(conditionalIssues(spec)).toHaveLength(1);
    });

    it("allows a container task to be conditional", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Greet");
      task.setIsEnabled("false");
      spec.addTask(task);

      expect(conditionalIssues(spec)).toHaveLength(0);
    });

    it("allows a subgraph with no run condition", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Inner", graphComponentSpec));

      expect(conditionalIssues(spec)).toHaveLength(0);
    });

    it("is the error that blocks submission", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Inner", graphComponentSpec);
      task.setIsEnabled("false");
      spec.addTask(task);

      expect(spec.isValid).toBe(false);

      task.setIsEnabled(undefined);

      expect(spec.isValid).toBe(true);
    });
  });

  describe("reserved input name rules", () => {
    const componentDeclaringReservedInput: ComponentSpecJson = {
      ...containerComponentSpec,
      inputs: [{ name: IS_ENABLED_PORT_NAME, optional: true }],
    };

    const reservedNameIssues = (spec: ComponentSpec) =>
      validateSpec(spec).filter((i) => i.issueCode === "RESERVED_INPUT_NAME");

    it("warns when a component declares the reserved input", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Greet", componentDeclaringReservedInput));

      expect(reservedNameIssues(spec)).toContainEqual(
        expect.objectContaining({
          type: "task",
          entityId: "t1",
          severity: "warning",
          argumentName: IS_ENABLED_PORT_NAME,
        }),
      );
    });

    it("does not block submission while the reserved input is unconnected", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Greet", componentDeclaringReservedInput));

      expect(spec.isValid).toBe(true);
    });

    it("errors once connected, because saving would drop the argument", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Flag", containerComponentSpec));
      spec.addTask(makeTask("t2", "Greet", componentDeclaringReservedInput));
      spec.addBinding(
        makeBinding("b1", "t1", "flag", "t2", IS_ENABLED_PORT_NAME),
      );

      expect(reservedNameIssues(spec)).toContainEqual(
        expect.objectContaining({ entityId: "t2", severity: "error" }),
      );
      expect(spec.isValid).toBe(false);
    });

    it("ignores components with ordinary input names", () => {
      const spec = makeSpec();
      spec.addTask(
        makeTask("t1", "Greet", {
          ...containerComponentSpec,
          inputs: [{ name: "name", optional: true }],
        }),
      );

      expect(reservedNameIssues(spec)).toHaveLength(0);
    });
  });

  describe("condition source type rules", () => {
    const componentWithFlagOutput = (
      type?: TypeSpecType,
    ): ComponentSpecJson => ({
      ...containerComponentSpec,
      outputs: [{ name: "flag", type }],
    });

    const typeIssues = (spec: ComponentSpec) =>
      validateSpec(spec).filter(
        (i) => i.issueCode === "CONDITION_SOURCE_TYPE_MISMATCH",
      );

    const gateOnTaskOutput = (type?: TypeSpecType) => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Flag", componentWithFlagOutput(type)));
      spec.addTask(makeTask("t2", "Greet", containerComponentSpec));
      spec.addBinding(
        makeBinding("b1", "t1", "flag", "t2", IS_ENABLED_PORT_NAME),
      );
      return spec;
    };

    it("blocks submission when the condition comes from a numeric output", () => {
      const spec = gateOnTaskOutput("Integer");

      expect(typeIssues(spec)).toContainEqual(
        expect.objectContaining({
          type: "task",
          entityId: "t2",
          severity: "error",
          referencedName: "Integer",
        }),
      );
      expect(spec.isValid).toBe(false);
    });

    it("accepts the types a condition can actually be read from", () => {
      expect(typeIssues(gateOnTaskOutput("String"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput("Boolean"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput("boolean"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput("Any"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput(undefined))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput({ Enum: "yes/no" }))).toHaveLength(0);
    });

    it("accepts the aliases a hand-written component might use", () => {
      expect(typeIssues(gateOnTaskOutput("bool"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput("str"))).toHaveLength(0);
      expect(typeIssues(gateOnTaskOutput("Text"))).toHaveLength(0);
    });

    it("errors when the condition comes from a numeric pipeline input", () => {
      const spec = makeSpec();
      spec.addInput(
        new Input({ $id: "i1", name: "threshold", type: "Integer" }),
      );
      spec.addTask(makeTask("t1", "Greet"));
      spec.addBinding(
        makeBinding("b1", "i1", "threshold", "t1", IS_ENABLED_PORT_NAME),
      );

      expect(typeIssues(spec)).toHaveLength(1);
    });

    it("stays quiet for a fixed condition, which has no source", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Greet");
      task.setIsEnabled("false");
      spec.addTask(task);

      expect(typeIssues(spec)).toHaveLength(0);
    });

    it("defers to the unsupported error on subgraphs", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Flag", componentWithFlagOutput("Integer")));
      spec.addTask(
        makeTask("t2", "Inner", { implementation: { graph: { tasks: {} } } }),
      );
      spec.addBinding(
        makeBinding("b1", "t1", "flag", "t2", IS_ENABLED_PORT_NAME),
      );

      expect(typeIssues(spec)).toHaveLength(0);
    });
  });

  describe("fixed run condition rules", () => {
    const conditionIssues = (spec: ComponentSpec) =>
      validateSpec(spec).filter((i) => i.issueCode === "INVALID_RUN_CONDITION");

    const gateOnLiteral = (condition: string) => {
      const spec = makeSpec();
      const task = makeTask("t1", "Greet", containerComponentSpec);
      task.setIsEnabled(condition);
      spec.addTask(task);
      return spec;
    };

    it("blocks submission on a condition the runtime cannot read", () => {
      const spec = gateOnLiteral("yes");

      expect(conditionIssues(spec)).toContainEqual(
        expect.objectContaining({
          type: "task",
          entityId: "t1",
          severity: "error",
          referencedName: "yes",
        }),
      );
      expect(spec.isValid).toBe(false);
    });

    it("accepts the canonical literals however they were written", () => {
      expect(conditionIssues(gateOnLiteral("true"))).toHaveLength(0);
      expect(conditionIssues(gateOnLiteral("false"))).toHaveLength(0);
      expect(conditionIssues(gateOnLiteral("False"))).toHaveLength(0);
      expect(conditionIssues(gateOnLiteral(" TRUE\n"))).toHaveLength(0);
    });

    it("stays quiet for a task with no run condition", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "Greet", containerComponentSpec));

      expect(conditionIssues(spec)).toHaveLength(0);
    });

    it("stays quiet for a connected condition, whose value is not known yet", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Greet", containerComponentSpec);
      task.setIsEnabled({
        taskOutput: { taskId: "Flag", outputName: "flag" },
      });
      spec.addTask(task);

      expect(conditionIssues(spec)).toHaveLength(0);
    });

    it("defers to the unsupported error on subgraphs", () => {
      const spec = makeSpec();
      const task = makeTask("t1", "Inner", {
        implementation: { graph: { tasks: {} } },
      });
      task.setIsEnabled("yes");
      spec.addTask(task);

      expect(conditionIssues(spec)).toHaveLength(0);
    });
  });

  describe("binding rules", () => {
    it("reports error for binding with non-existent source entity", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addBinding(
        makeBinding("b1", "nonExistentSource", "out", "t1", "in"),
      );

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "graph",
          message:
            'Binding references non-existent source entity: "nonExistentSource"',
          severity: "error",
        }),
      );
    });

    it("reports error for binding with non-existent target entity", () => {
      const spec = makeSpec();
      spec.addTask(makeTask("t1", "TaskA"));
      spec.addBinding(
        makeBinding("b1", "t1", "out", "nonExistentTarget", "in"),
      );

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "graph",
          message:
            'Binding references non-existent target entity: "nonExistentTarget"',
          severity: "error",
        }),
      );
    });

    it("does not report errors for valid bindings", () => {
      const spec = makeSpec();
      const input = makeInput("i1", "source");
      const task = makeTask("t1", "TaskA");
      spec.addInput(input);
      spec.addTask(task);
      spec.addBinding(makeBinding("b1", "i1", "source", "t1", "data"));

      const issues = validateSpec(spec);
      const bindingIssues = issues.filter((i) =>
        i.message.includes("Binding references"),
      );

      expect(bindingIssues).toHaveLength(0);
    });
  });

  describe("circular dependency detection", () => {
    it("reports error for circular dependency via bindings", () => {
      const spec = makeSpec();
      const taskA = makeTask("tA", "TaskA");
      const taskB = makeTask("tB", "TaskB");
      spec.addTask(taskA);
      spec.addTask(taskB);

      // A depends on B, B depends on A
      spec.addBinding(makeBinding("b1", "tA", "outputA", "tB", "inputB"));
      spec.addBinding(makeBinding("b2", "tB", "outputB", "tA", "inputA"));

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: "Circular dependency detected",
          severity: "error",
        }),
      );
    });

    it("reports error for circular dependency via task arguments", () => {
      const spec = makeSpec();
      const taskA = makeTask("tA", "TaskA");
      const taskB = makeTask("tB", "TaskB");

      // A's argument references B, B's argument references A
      taskA.setArgument("input", {
        taskOutput: { taskId: "TaskB", outputName: "out" },
      });
      taskB.setArgument("input", {
        taskOutput: { taskId: "TaskA", outputName: "out" },
      });

      spec.addTask(taskA);
      spec.addTask(taskB);

      const issues = validateSpec(spec);

      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "task",
          message: "Circular dependency detected",
          severity: "error",
        }),
      );
    });

    it("does not report cycle for valid DAG", () => {
      const spec = makeSpec();
      const taskA = makeTask("tA", "TaskA");
      const taskB = makeTask("tB", "TaskB");
      const taskC = makeTask("tC", "TaskC");
      spec.addTask(taskA);
      spec.addTask(taskB);
      spec.addTask(taskC);

      // A -> B -> C (no cycle)
      spec.addBinding(makeBinding("b1", "tA", "out", "tB", "in"));
      spec.addBinding(makeBinding("b2", "tB", "out", "tC", "in"));

      const issues = validateSpec(spec);
      const cycleIssues = issues.filter((i) =>
        i.message.includes("Circular dependency"),
      );

      expect(cycleIssues).toHaveLength(0);
    });
  });

  describe("computed properties on ComponentSpec", () => {
    it("spec.validationIssues returns computed issues", () => {
      const spec = makeSpec("");
      const issues = spec.validationIssues;

      expect(issues.length).toBeGreaterThan(0);
      expect(issues).toContainEqual(
        expect.objectContaining({
          type: "graph",
          message: "Component name is required and cannot be empty",
        }),
      );
    });

    it("spec.isValid returns false when there are issues", () => {
      const spec = makeSpec("");
      expect(spec.isValid).toBe(false);
    });

    it("spec.isValid returns true when there are no issues", () => {
      const spec = makeSpec("ValidPipeline");
      spec.addTask(
        makeTask("t1", "TaskA", {
          name: "SomeComponent",
          implementation: { container: { image: "test" } },
        }),
      );
      expect(spec.isValid).toBe(true);
    });

    it("spec.issuesByEntityId groups issues by entity", () => {
      const taskComponentSpec: ComponentSpecJson = {
        name: "Component",
        inputs: [{ name: "required", optional: false }],
        implementation: { container: { image: "test" } },
      };

      const spec = makeSpec();
      const task = makeTask("t1", "TaskA", taskComponentSpec);
      spec.addTask(task);

      const byEntity = spec.issuesByEntityId;
      const taskIssues = byEntity.get("t1");

      expect(taskIssues).toBeDefined();
      expect(taskIssues!.length).toBeGreaterThan(0);
    });

    it("spec.graphLevelIssues returns only issues without entityId", () => {
      const spec = makeSpec("");

      const graphIssues = spec.graphLevelIssues;

      expect(graphIssues.length).toBeGreaterThan(0);
      expect(graphIssues.every((i) => !i.entityId)).toBe(true);
    });
  });
});
