import { describe, expect, it } from "vitest";

import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { createComponentSpecProxy } from "../../entities/componentSpecProxy";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";
import type { GraphImplementation } from "../../entities/types";

function makeMinimalSpec(
  overrides?: Partial<ConstructorParameters<typeof ComponentSpec>[0]>,
): ComponentSpec {
  return new ComponentSpec({
    $id: "spec_1",
    name: "TestPipeline",
    ...overrides,
  });
}

function getGraph(
  proxy: ReturnType<typeof createComponentSpecProxy>,
): GraphImplementation["graph"] {
  if ("graph" in proxy.implementation) {
    return proxy.implementation.graph;
  }
  throw new Error("Expected graph implementation");
}

describe("createComponentSpecProxy", () => {
  describe("name", () => {
    it("returns spec name", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect(proxy.name).toBe("TestPipeline");
    });
  });

  describe("description", () => {
    it("returns spec description", () => {
      const proxy = createComponentSpecProxy(
        makeMinimalSpec({ description: "A test pipeline" }),
      );
      expect(proxy.description).toBe("A test pipeline");
    });

    it("returns undefined when description is absent", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect(proxy.description).toBeUndefined();
    });
  });

  describe("inputs", () => {
    it("maps input models to InputSpec shape", () => {
      const spec = makeMinimalSpec();
      spec.addInput(
        new Input({
          $id: "in_1",
          name: "data",
          type: "string",
          description: "Input data",
          defaultValue: "hello",
          optional: true,
        }),
      );

      const proxy = createComponentSpecProxy(spec);

      expect(proxy.inputs).toEqual([
        {
          name: "data",
          type: "string",
          description: "Input data",
          default: "hello",
          optional: true,
        },
      ]);
    });

    it("returns empty array when no inputs", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect(proxy.inputs).toEqual([]);
    });
  });

  describe("outputs", () => {
    it("maps output models to OutputSpec shape", () => {
      const spec = makeMinimalSpec();
      spec.addOutput(
        new Output({
          $id: "out_1",
          name: "result",
          type: "object",
          description: "The result",
        }),
      );

      const proxy = createComponentSpecProxy(spec);

      expect(proxy.outputs).toEqual([
        {
          name: "result",
          type: "object",
          description: "The result",
        },
      ]);
    });

    it("returns empty array when no outputs", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect(proxy.outputs).toEqual([]);
    });
  });

  describe("implementation", () => {
    it("returns a graph implementation", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect("graph" in proxy.implementation).toBe(true);
    });

    it("serializes tasks with componentRef", () => {
      const spec = makeMinimalSpec();
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "Train",
          componentRef: { name: "TrainerComponent" },
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks).toHaveProperty("Train");
      expect(graph.tasks["Train"].componentRef).toEqual({
        name: "TrainerComponent",
      });
    });

    it("serializes multiple tasks keyed by name", () => {
      const spec = makeMinimalSpec();
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "Load",
          componentRef: { name: "Loader" },
        }),
      );
      spec.addTask(
        new Task({
          $id: "task_2",
          name: "Process",
          componentRef: { name: "Processor" },
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(Object.keys(graph.tasks)).toEqual(
        expect.arrayContaining(["Load", "Process"]),
      );
    });

    it("serializes literal task arguments", () => {
      const spec = makeMinimalSpec();
      const task = new Task({
        $id: "task_1",
        name: "Train",
        componentRef: {},
      });
      task.addArgument({ name: "epochs", value: "10" });
      task.addArgument({ name: "lr", value: "0.01" });
      spec.addTask(task);

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks["Train"].arguments).toEqual({
        epochs: "10",
        lr: "0.01",
      });
    });

    it("serializes bindings from inputs as graphInput arguments", () => {
      const spec = makeMinimalSpec();
      const input = new Input({ $id: "in_1", name: "data" });
      spec.addInput(input);
      const task = new Task({
        $id: "task_1",
        name: "Train",
        componentRef: {},
      });
      spec.addTask(task);
      spec.addBinding(
        new Binding({
          $id: "b_1",
          sourceEntityId: "in_1",
          targetEntityId: "task_1",
          sourcePortName: "data",
          targetPortName: "input_data",
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks["Train"].arguments).toEqual({
        input_data: { graphInput: { inputName: "data" } },
      });
    });

    it("serializes bindings between tasks as taskOutput arguments", () => {
      const spec = makeMinimalSpec();
      const taskA = new Task({
        $id: "task_a",
        name: "Load",
        componentRef: {},
      });
      const taskB = new Task({
        $id: "task_b",
        name: "Train",
        componentRef: {},
      });
      spec.addTask(taskA);
      spec.addTask(taskB);
      spec.addBinding(
        new Binding({
          $id: "b_1",
          sourceEntityId: "task_a",
          targetEntityId: "task_b",
          sourcePortName: "output",
          targetPortName: "dataset",
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks["Train"].arguments).toEqual({
        dataset: { taskOutput: { taskId: "Load", outputName: "output" } },
      });
    });

    it("serializes graph output values", () => {
      const spec = makeMinimalSpec();
      const task = new Task({
        $id: "task_1",
        name: "Train",
        componentRef: {},
      });
      const output = new Output({ $id: "out_1", name: "model" });
      spec.addTask(task);
      spec.addOutput(output);
      spec.addBinding(
        new Binding({
          $id: "b_1",
          sourceEntityId: "task_1",
          targetEntityId: "out_1",
          sourcePortName: "trained_model",
          targetPortName: "model",
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.outputValues).toEqual({
        model: {
          taskOutput: { taskId: "Train", outputName: "trained_model" },
        },
      });
    });

    it("omits outputValues when there are no output bindings", () => {
      const spec = makeMinimalSpec();
      spec.addTask(new Task({ $id: "task_1", name: "T", componentRef: {} }));

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.outputValues).toBeUndefined();
    });

    it("serializes isEnabled on tasks", () => {
      const spec = makeMinimalSpec();
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "T",
          componentRef: {},
          isEnabled: { "==": { op1: "a", op2: "b" } },
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks["T"].isEnabled).toEqual({
        "==": { op1: "a", op2: "b" },
      });
    });

    it("serializes executionOptions on tasks", () => {
      const spec = makeMinimalSpec();
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "T",
          componentRef: {},
          executionOptions: {
            cachingStrategy: { maxCacheStaleness: "P0D" },
          },
        }),
      );

      const graph = getGraph(createComponentSpecProxy(spec));

      expect(graph.tasks["T"].executionOptions).toEqual({
        cachingStrategy: { maxCacheStaleness: "P0D" },
      });
    });

    it("serializes subgraph spec recursively", () => {
      const innerSpec = makeMinimalSpec({
        $id: "inner_spec",
        name: "InnerPipeline",
      });
      innerSpec.addTask(
        new Task({
          $id: "inner_task",
          name: "InnerStep",
          componentRef: { name: "InnerComponent" },
        }),
      );

      const outerSpec = makeMinimalSpec({
        $id: "outer_spec",
        name: "OuterPipeline",
      });
      const outerTask = new Task({
        $id: "task_1",
        name: "SubgraphTask",
        componentRef: {},
      });
      outerTask.setSubgraphSpec(innerSpec);
      outerSpec.addTask(outerTask);

      const graph = getGraph(createComponentSpecProxy(outerSpec));

      const taskSpec = graph.tasks["SubgraphTask"];
      expect(taskSpec.componentRef.spec).toBeDefined();
      expect(taskSpec.componentRef.spec?.name).toBe("InnerPipeline");
      expect(
        "graph" in (taskSpec.componentRef.spec?.implementation ?? {}),
      ).toBe(true);
    });

    it("returns empty tasks for a spec with no tasks", () => {
      const graph = getGraph(createComponentSpecProxy(makeMinimalSpec()));
      expect(graph.tasks).toEqual({});
    });
  });

  describe("metadata", () => {
    it("serializes annotations as metadata", () => {
      const spec = makeMinimalSpec();
      spec.setMetadata("author", "Alice");

      const proxy = createComponentSpecProxy(spec);

      expect(proxy.metadata).toEqual({
        annotations: { author: "Alice" },
      });
    });

    it("returns undefined when no annotations", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect(proxy.metadata).toBeUndefined();
    });
  });

  describe("has trap", () => {
    it("returns true for known keys", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      const knownKeys = [
        "name",
        "description",
        "inputs",
        "outputs",
        "implementation",
        "metadata",
      ];

      for (const key of knownKeys) {
        expect(key in proxy).toBe(true);
      }
    });

    it("returns false for unknown keys", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());
      expect("foo" in proxy).toBe(false);
      expect("tasks" in proxy).toBe(false);
      expect("bindings" in proxy).toBe(false);
    });
  });

  describe("unknown properties", () => {
    it("returns undefined for unrecognized properties", () => {
      const proxy = createComponentSpecProxy(makeMinimalSpec());

      expect((proxy as any).nonexistent).toBeUndefined();
    });
  });
});
