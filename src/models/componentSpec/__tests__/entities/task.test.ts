import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { Task } from "../../entities/task";

describe("Task", () => {
  it("creates with required properties", () => {
    const task = new Task({
      $id: "task_1",
      name: "ProcessData",
      componentRef: { name: "DataProcessor" },
    });

    expect(task.$id).toBe("task_1");
    expect(task.name).toBe("ProcessData");
    expect(task.componentRef).toEqual({ name: "DataProcessor" });
  });

  it("has empty annotations and arguments by default", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    expect(task.annotations.length).toBe(0);
    expect(task.arguments.length).toBe(0);
  });

  it("annotations.add adds to annotations", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.annotations.add({ key: "foo", value: "bar" });

    expect(task.annotations.length).toBe(1);
    expect(task.annotations.items[0]).toEqual({ key: "foo", value: "bar" });
  });

  it("addArgument adds to arguments", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.addArgument({ name: "input", value: "test" });

    expect(task.arguments.length).toBe(1);
    expect(task.arguments[0]).toEqual({ name: "input", value: "test" });
  });

  it("can set isEnabled predicate", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      isEnabled: { taskOutput: { taskId: "task1", outputName: "out1" } },
    });

    expect(task.isEnabled).toEqual({
      taskOutput: { taskId: "task1", outputName: "out1" },
    });
  });

  it("setName updates name", () => {
    const task = new Task({
      $id: "task_1",
      name: "OldName",
      componentRef: {},
    });

    task.setName("NewName");

    expect(task.name).toBe("NewName");
  });

  it("setComponentRef updates componentRef", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: { name: "A" },
    });

    task.setComponentRef({ name: "B" });

    expect(task.componentRef).toEqual({ name: "B" });
  });

  it("has undefined executionOptions by default", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    expect(task.executionOptions).toBeUndefined();
  });

  it("can be created with executionOptions", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    expect(task.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("setCacheStaleness sets cachingStrategy", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.setCacheStaleness("P0D");

    expect(task.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("setCacheStaleness clears executionOptions when no other options remain", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    task.setCacheStaleness(undefined);

    expect(task.executionOptions).toBeUndefined();
  });

  it("setCacheStaleness preserves retryStrategy when clearing cache", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        retryStrategy: { maxRetries: 3 },
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    task.setCacheStaleness(undefined);

    expect(task.executionOptions).toEqual({
      retryStrategy: { maxRetries: 3 },
    });
  });

  describe("resolvedComponentRef", () => {
    const subgraphRef = {
      name: "Subgraph",
      digest: "digest123",
      spec: {
        name: "Subgraph",
        inputs: [{ name: "page", type: "String" }],
        implementation: {
          graph: {
            tasks: {
              Inner: {
                componentRef: {
                  name: "Inner",
                  spec: {
                    name: "Inner",
                    implementation: { container: { image: "inner:latest" } },
                  },
                },
              },
            },
          },
        },
      },
    };

    it("returns the reference unchanged for a container task", () => {
      const componentRef = {
        name: "Container",
        digest: "digest456",
        spec: {
          name: "Container",
          implementation: { container: { image: "container:latest" } },
        },
      };
      const task = new Task({ $id: "task_1", name: "T", componentRef });

      expect(task.resolvedComponentRef).toBe(task.componentRef);
      expect(task.resolvedComponentRef.spec).toEqual(componentRef.spec);
    });

    it("re-attaches the spec that setComponentRef stripped from a subgraph task", () => {
      const task = new Task({ $id: "task_1", name: "T", componentRef: {} });
      task.setComponentRef(subgraphRef);

      expect(task.componentRef.spec).toBeUndefined();
      expect(task.resolvedComponentRef.name).toBe("Subgraph");
      expect(task.resolvedComponentRef.digest).toBe("digest123");
      expect(task.resolvedComponentRef.spec?.implementation).toHaveProperty(
        "graph",
      );
      expect(task.resolvedComponentRef.spec?.inputs).toEqual([
        expect.objectContaining({ name: "page", type: "String" }),
      ]);
    });

    it("yields a spec that survives yaml.dump, unlike resolvedComponentSpec", () => {
      const task = new Task({ $id: "task_1", name: "T", componentRef: {} });
      task.setComponentRef(subgraphRef);

      const dumped = yaml.load(
        yaml.dump(task.resolvedComponentRef.spec),
      ) as Record<string, unknown>;

      expect(dumped).toHaveProperty("implementation");
      expect(yaml.dump(task.resolvedComponentSpec)).toBe("{}\n");
    });
  });
});
