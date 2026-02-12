import { proxy, snapshot, subscribe } from "valtio";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpecEntity } from "../componentSpec";
import { RootContext } from "../context";
import { GraphImplementation } from "../graphImplementation";
import { simpleContainerComponentRef } from "./fixtures";

describe("Valtio Reactivity for ComponentSpec Object Model", () => {
  let rootContext: RootContext;

  beforeEach(() => {
    rootContext = new RootContext();
  });

  describe("Entity mutations trigger reactivity", () => {
    it("should track changes to entity properties", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      rootContext.registerEntity(componentSpec);

      const input = componentSpec.inputs.add({
        name: "test_input",
        type: "String",
      });

      // Wrap in proxy to enable tracking
      const proxiedInput = proxy(input);
      const callback = vi.fn();

      // Subscribe to changes
      const unsubscribe = subscribe(proxiedInput, callback);

      // Mutate the entity
      proxiedInput.name = "renamed_input";

      // Wait for async notification
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
      expect(proxiedInput.name).toBe("renamed_input");

      unsubscribe();
    });

    it("should track changes to task entity properties", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "original_task",
        componentRef: simpleContainerComponentRef,
      });

      const callback = vi.fn();
      const unsubscribe = subscribe(task, callback);

      // Mutate the task name
      task.name = "renamed_task";

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
      expect(task.name).toBe("renamed_task");

      unsubscribe();
    });
  });

  describe("Collection operations trigger reactivity", () => {
    it("should track adding entities to InputsCollection", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );

      // Collections are already wrapped with proxy() in the constructor,
      // so we subscribe directly to the collection
      const callback = vi.fn();
      const unsubscribe = subscribe(componentSpec.inputs, callback);

      // Add an entity
      componentSpec.inputs.add({
        name: "new_input",
        type: "String",
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
      expect(Object.keys(componentSpec.inputs.entities).length).toBe(1);

      unsubscribe();
    });

    it("should track adding entities to TasksCollection", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      // Collections are already wrapped with proxy() in the constructor,
      // so we subscribe directly to the collection
      const callback = vi.fn();
      const unsubscribe = subscribe(graphImpl.tasks, callback);

      // Add a task
      graphImpl.tasks.add({
        name: "new_task",
        componentRef: simpleContainerComponentRef,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
      expect(Object.keys(graphImpl.tasks.entities).length).toBe(1);

      unsubscribe();
    });
  });

  describe("GraphImplementation output values use Record (not Map)", () => {
    it("should track setOutputValue changes via Record", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      // Wrap the graph implementation in a proxy
      const proxiedGraphImpl = proxy(graphImpl);
      const callback = vi.fn();
      const unsubscribe = subscribe(proxiedGraphImpl, callback);

      // Set an output value
      proxiedGraphImpl.setOutputValue("output1", "task1", "result");

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();

      // Verify the value was set
      const outputValues = proxiedGraphImpl.getOutputValues();
      expect(outputValues).toHaveLength(1);
      expect(outputValues[0]).toEqual({
        outputName: "output1",
        taskId: "task1",
        taskOutputName: "result",
      });

      unsubscribe();
    });

    it("should track removeOutputValue changes", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      // Add an output value first
      graphImpl.setOutputValue("output1", "task1", "result");

      const proxiedGraphImpl = proxy(graphImpl);
      const callback = vi.fn();
      const unsubscribe = subscribe(proxiedGraphImpl, callback);

      // Remove the output value
      proxiedGraphImpl.removeOutputValue("output1");

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();
      expect(proxiedGraphImpl.getOutputValues()).toHaveLength(0);

      unsubscribe();
    });

    it("should serialize output values correctly to JSON", () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      graphImpl.tasks.add({
        name: "task1",
        componentRef: simpleContainerComponentRef,
      });

      // Set output value binding
      graphImpl.setOutputValue("final_output", "task1", "task_result");

      const json = graphImpl.toJson();

      expect(json.graph.outputValues).toEqual({
        final_output: {
          taskOutput: {
            taskId: "task1",
            outputName: "task_result",
          },
        },
      });
    });
  });

  describe("Nested collections are reactive", () => {
    it("should track nested annotations collection changes", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );

      const input = componentSpec.inputs.add({
        name: "annotated_input",
        type: "String",
      });

      // Proxy the input entity (which contains nested annotations collection)
      const proxiedInput = proxy(input);
      const callback = vi.fn();
      const unsubscribe = subscribe(proxiedInput, callback);

      // Add an annotation to the nested collection
      proxiedInput.annotations.add({ key: "hint", value: "text_area" });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // The callback should be triggered when nested collection changes
      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it("should track nested arguments collection changes on TaskEntity", async () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "test_task",
        componentRef: simpleContainerComponentRef,
      });

      const callback = vi.fn();
      const unsubscribe = subscribe(task, callback);

      // Add an argument to the nested collection
      task.arguments.add({ name: "input_data" });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe("Snapshot creates immutable copies", () => {
    it("should create immutable snapshot of entity", () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );

      const input = componentSpec.inputs.add({
        name: "test_input",
        type: "String",
      });

      const proxiedInput = proxy(input);
      const snap = snapshot(proxiedInput);

      // Snapshot should reflect current state
      expect(snap.name).toBe("test_input");

      // Mutating the proxy should not affect snapshot
      proxiedInput.name = "changed";
      expect(snap.name).toBe("test_input");
      expect(proxiedInput.name).toBe("changed");
    });

    it("should create immutable snapshot of collection entities", () => {
      const componentSpec = new ComponentSpecEntity(
        rootContext.generateId(),
        rootContext,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      graphImpl.tasks.add({
        name: "task1",
        componentRef: simpleContainerComponentRef,
      });

      const proxiedEntities = proxy(graphImpl.tasks.entities);
      const snap = snapshot(proxiedEntities);

      // Add another task
      graphImpl.tasks.add({
        name: "task2",
        componentRef: simpleContainerComponentRef,
      });

      // Snapshot should still have only 1 task
      expect(Object.keys(snap).length).toBe(1);
      expect(Object.keys(proxiedEntities).length).toBe(2);
    });
  });
});
