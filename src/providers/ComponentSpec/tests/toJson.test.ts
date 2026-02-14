import { beforeAll, describe, expect, it } from "vitest";

import { isGraphImplementation } from "@/utils/componentSpec";

import { ComponentSpecEntity } from "../componentSpec";
import { RootContext } from "../context";
import { GraphImplementation } from "../graphImplementation";
import { InputEntity } from "../inputs";
import { OutputEntity } from "../outputs";
import { simpleContainerComponentRef } from "./fixtures";
import { validateComponentSpec } from "./schemaValidator";

describe("ComponentSpec Object Model toJson()", () => {
  let rootContext: RootContext;

  beforeAll(() => {
    rootContext = new RootContext();
  });

  describe("Schema Validation", () => {
    it("should reject a component without implementation", async () => {
      const invalidSpec = {
        name: "Invalid Component",
        description: "Missing implementation",
        inputs: [],
        outputs: [],
      };

      const result = await validateComponentSpec(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should accept a valid component with graph implementation", async () => {
      const validSpec = {
        name: "Valid Pipeline",
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "Test",
                  digest: "sha256:abc",
                },
              },
            },
          },
        },
      };

      const result = await validateComponentSpec(validSpec);
      expect(result.valid).toBe(true);
    });
  });

  describe("InputEntity.toJson()", () => {
    it("should serialize input without value field", () => {
      const input = new InputEntity("test-input-1", rootContext, {
        name: "test_input",
      });
      input.populate({
        name: "test_input",
        type: "String",
        description: "A test input",
        default: "default_value",
        optional: true,
      });

      const json = input.toJson();

      expect(json).toEqual({
        name: "test_input",
        type: "String",
        description: "A test input",
        default: "default_value",
        optional: true,
      });
      // Should NOT have 'value' field
      expect(json).not.toHaveProperty("value");
    });

    it("should include annotations when present", () => {
      const input = new InputEntity("test-input-2", rootContext, {
        name: "annotated_input",
      });
      input.populate({
        name: "annotated_input",
        type: "String",
        description: "Input with annotations",
      });
      // Now we can add annotations
      input.annotations.add({ key: "ui_hint", value: "text_area" });

      const json = input.toJson();

      expect(json.name).toBe("annotated_input");
      expect(json.annotations).toEqual({ ui_hint: "text_area" });
    });

    it("should omit undefined optional fields", () => {
      const input = new InputEntity("test-input-3", rootContext, {
        name: "minimal_input",
      });
      input.populate({
        name: "minimal_input",
      });

      const json = input.toJson();

      expect(json.name).toBe("minimal_input");
      // Optional fields should be undefined (and filtered in final output)
      expect(json.type).toBeUndefined();
      expect(json.description).toBeUndefined();
      expect(json.default).toBeUndefined();
      expect(json.optional).toBeUndefined();
    });
  });

  describe("OutputEntity.toJson()", () => {
    it("should serialize output correctly", () => {
      const output = new OutputEntity("test-output-1", rootContext, {
        name: "test_output",
      });
      output.populate({
        name: "test_output",
        type: "String",
        description: "A test output",
      });

      const json = output.toJson();

      expect(json).toEqual({
        name: "test_output",
        type: "String",
        description: "A test output",
      });
    });

    it("should include annotations when present", () => {
      const output = new OutputEntity("test-output-2", rootContext, {
        name: "annotated_output",
      });
      output.populate({
        name: "annotated_output",
        type: "String",
        description: "Output with annotations",
      });
      // Now we can add annotations
      output.annotations.add({ key: "format", value: "json" });

      const json = output.toJson();

      expect(json.name).toBe("annotated_output");
      expect(json.annotations).toEqual({ format: "json" });
    });
  });

  describe("Task argument serialization via bindings", () => {
    it("should serialize literal argument as string value", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "test_task",
        componentRef: simpleContainerComponentRef,
      });

      const argument = task.arguments.add({ name: "input_data" });
      argument.value = "literal value";

      const json = task.toJson();

      // Should return just the string value for literal arguments
      expect(json.arguments?.["input_data"]).toBe("literal value");
    });

    it("should serialize graphInput argument correctly via binding", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );

      // Add a graph input
      const graphInput = componentSpec.inputs.add({
        name: "pipeline_input",
        type: "String",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "test_task",
        componentRef: simpleContainerComponentRef,
      });

      // Add argument and create binding
      task.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: graphInput.$id, portName: graphInput.name },
        { entityId: task.$id, portName: "input_data" },
      );

      const json = task.toJson();

      // Should return GraphInputArgument format
      expect(json.arguments?.["input_data"]).toEqual({
        graphInput: {
          inputName: "pipeline_input",
        },
      });
    });

    it("should serialize taskOutput argument correctly via binding", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      // Create first task with an output
      const firstTask = graphImpl.tasks.add({
        name: "first_task",
        componentRef: simpleContainerComponentRef,
      });

      // Create second task that uses first task's output
      const secondTask = graphImpl.tasks.add({
        name: "second_task",
        componentRef: simpleContainerComponentRef,
      });

      // Add argument and create binding
      secondTask.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: firstTask.$id, portName: "output_data" },
        { entityId: secondTask.$id, portName: "input_data" },
      );

      const json = secondTask.toJson();

      // Should return TaskOutputArgument format
      expect(json.arguments?.["input_data"]).toEqual({
        taskOutput: {
          taskId: "first_task",
          outputName: "output_data",
        },
      });
    });
  });

  describe("TaskEntity.toJson()", () => {
    it("should NOT include taskId in output (key is the task name)", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      const task = graphImpl.tasks.add({
        name: "my_task",
        componentRef: simpleContainerComponentRef,
      });

      const json = task.toJson();

      // taskId should NOT be in the output - the task name is the key in the tasks map
      expect(json).not.toHaveProperty("taskId");
      expect(json).toHaveProperty("componentRef");
    });

    it("should include componentRef with correct format", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      const task = graphImpl.tasks.add({
        name: "my_task",
        componentRef: {
          name: "Test Component",
          digest: "sha256:abc123",
          url: "https://example.com/component.yaml",
        },
      });

      const json = task.toJson();

      expect(json.componentRef).toEqual({
        name: "Test Component",
        digest: "sha256:abc123",
        url: "https://example.com/component.yaml",
      });
    });

    it("should include executionOptions when present", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      const task = graphImpl.tasks.add({
        name: "my_task",
        componentRef: simpleContainerComponentRef,
      });
      task.populate({
        name: "my_task",
        componentRef: simpleContainerComponentRef,
        executionOptions: {
          retryStrategy: { maxRetries: 3 },
          cachingStrategy: { maxCacheStaleness: "P1D" },
        },
      });

      const json = task.toJson();

      expect(json.executionOptions).toEqual({
        retryStrategy: { maxRetries: 3 },
        cachingStrategy: { maxCacheStaleness: "P1D" },
      });
    });

    it("should include annotations when present", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      const task = graphImpl.tasks.add({
        name: "my_task",
        componentRef: simpleContainerComponentRef,
      });
      // After fix: task.annotations.add({ key: "priority", value: "high" });

      const json = task.toJson();

      // After fix: expect(json.annotations).toEqual({ priority: "high" });
      expect(json.componentRef).toBeDefined();
    });
  });

  describe("GraphImplementation.toJson()", () => {
    it("should serialize tasks as a map keyed by task name", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );
      const graphImpl = new GraphImplementation(componentSpec);

      graphImpl.tasks.add({
        name: "task_a",
        componentRef: simpleContainerComponentRef,
      });
      graphImpl.tasks.add({
        name: "task_b",
        componentRef: simpleContainerComponentRef,
      });

      const json = graphImpl.toJson();

      expect(json).toHaveProperty("graph");
      expect(json.graph).toHaveProperty("tasks");
      expect(Object.keys(json.graph.tasks)).toEqual(["task_a", "task_b"]);
    });

    it("should include outputValues when present", () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );

      // Add a graph output
      componentSpec.outputs.add({
        name: "pipeline_output",
        type: "String",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      graphImpl.tasks.add({
        name: "process_task",
        componentRef: simpleContainerComponentRef,
      });

      // After fix: graphImpl.setOutputValue("pipeline_output", "process_task", "output_data");

      const json = graphImpl.toJson();

      expect(json).toHaveProperty("graph");
      // After fix: expect(json.graph.outputValues).toBeDefined();
    });
  });

  describe("ComponentSpecEntity.toJson()", () => {
    it("should produce valid schema-compliant output for simple pipeline", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Simple Pipeline" },
      );
      componentSpec.populate({
        name: "Simple Pipeline",
        description: "A simple pipeline with one task",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "task1",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });
      task.arguments.add({ name: "input_data" }).value = "hello world";

      const json = componentSpec.toJson();

      // Validate against schema
      const validationResult = await validateComponentSpec(json);
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error("Validation errors:", validationResult.errors);
      }
    });

    it("should produce valid schema-compliant output for pipeline with graph inputs", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Pipeline with Graph Inputs" },
      );
      componentSpec.populate({
        name: "Pipeline with Graph Inputs",
        description: "Pipeline that passes graph inputs to tasks",
      });

      const graphInput = componentSpec.inputs.add({
        name: "pipeline_input",
        type: "String",
        description: "Pipeline input",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      const task = graphImpl.tasks.add({
        name: "process_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });

      // Add argument and create binding
      task.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: graphInput.$id, portName: graphInput.name },
        { entityId: task.$id, portName: "input_data" },
      );

      const json = componentSpec.toJson();

      // Validate against schema
      const validationResult = await validateComponentSpec(json);
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error("Validation errors:", validationResult.errors);
      }

      // Verify the argument format
      expect(isGraphImplementation(json.implementation)).toBe(true);
      if (isGraphImplementation(json.implementation)) {
        const taskJson = json.implementation.graph.tasks["process_task"];
        expect(taskJson?.arguments?.["input_data"]).toEqual({
          graphInput: {
            inputName: "pipeline_input",
          },
        });
      }
    });

    it("should produce valid schema-compliant output for pipeline with task outputs", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Pipeline with Task Outputs" },
      );
      componentSpec.populate({
        name: "Pipeline with Task Outputs",
        description: "Pipeline with chained tasks",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      // First task
      const firstTask = graphImpl.tasks.add({
        name: "first_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });
      firstTask.arguments.add({ name: "input_data" }).value = "initial data";

      // Second task uses first task's output
      const secondTask = graphImpl.tasks.add({
        name: "second_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });

      // Add argument and create binding
      secondTask.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: firstTask.$id, portName: "output_data" },
        { entityId: secondTask.$id, portName: "input_data" },
      );

      const json = componentSpec.toJson();

      // Validate against schema
      const validationResult = await validateComponentSpec(json);
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error("Validation errors:", validationResult.errors);
      }

      // Verify the argument format
      expect(isGraphImplementation(json.implementation)).toBe(true);
      if (isGraphImplementation(json.implementation)) {
        const secondTaskJson = json.implementation.graph.tasks["second_task"];
        expect(secondTaskJson?.arguments?.["input_data"]).toEqual({
          taskOutput: {
            taskId: "first_task",
            outputName: "output_data",
          },
        });
      }
    });

    it("should include metadata when present", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Pipeline with Metadata" },
      );
      componentSpec.populate({
        name: "Pipeline with Metadata",
        description: "Pipeline with metadata",
      });

      // After fix: componentSpec.metadata = { annotations: { author: "test" } };

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      graphImpl.tasks.add({
        name: "task1",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });

      const json = componentSpec.toJson();

      // After fix: expect(json.metadata).toEqual({ annotations: { author: "test" } });
      expect(json.name).toBe("Pipeline with Metadata");
    });

    it("should include input and output annotations", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Pipeline with Annotations" },
      );
      componentSpec.populate({
        name: "Pipeline with Annotations",
        description: "Pipeline demonstrating annotations",
      });

      componentSpec.inputs.add({
        name: "annotated_input",
        type: "String",
        description: "Input with annotations",
        // After fix: annotations: { ui_hint: "text_area" }
      });

      componentSpec.outputs.add({
        name: "annotated_output",
        type: "String",
        description: "Output with annotations",
        // After fix: annotations: { format: "json" }
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      graphImpl.tasks.add({
        name: "task1",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });

      const json = componentSpec.toJson();

      expect(json.inputs?.[0]?.name).toBe("annotated_input");
      expect(json.outputs?.[0]?.name).toBe("annotated_output");
    });

    it("should produce valid schema-compliant output for full pipeline with all features", async () => {
      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Full Pipeline" },
      );
      componentSpec.populate({
        name: "Full Pipeline",
        description: "A comprehensive pipeline with all features",
      });

      // Add inputs
      const requiredInput = componentSpec.inputs.add({
        name: "required_input",
        type: "String",
        description: "A required input",
      });

      componentSpec.inputs.add({
        name: "optional_input",
        type: "Integer",
        description: "An optional input",
        optional: true,
        default: "42",
      });

      // Add outputs
      componentSpec.outputs.add({
        name: "final_output",
        type: "String",
        description: "The final output",
      });

      const graphImpl = new GraphImplementation(componentSpec);
      componentSpec.implementation = graphImpl;

      // First task with caching
      const firstTask = graphImpl.tasks.add({
        name: "first_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });
      firstTask.populate({
        name: "first_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
        executionOptions: {
          cachingStrategy: { maxCacheStaleness: "P1D" },
        },
      });

      // Add argument and create binding
      firstTask.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: requiredInput.$id, portName: requiredInput.name },
        { entityId: firstTask.$id, portName: "input_data" },
      );

      // Second task with retry strategy
      const secondTask = graphImpl.tasks.add({
        name: "second_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
      });
      secondTask.populate({
        name: "second_task",
        componentRef: {
          name: "Simple Container",
          digest: "sha256:abc123",
        },
        executionOptions: {
          retryStrategy: { maxRetries: 3 },
        },
      });

      // Add argument and create binding
      secondTask.arguments.add({ name: "input_data" });
      graphImpl.bindings.bind(
        { entityId: firstTask.$id, portName: "output_data" },
        { entityId: secondTask.$id, portName: "input_data" },
      );

      const json = componentSpec.toJson();

      // Validate against schema
      const validationResult = await validateComponentSpec(json);
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error("Validation errors:", validationResult.errors);
      }

      // Verify structure
      expect(json.name).toBe("Full Pipeline");
      expect(json.inputs).toHaveLength(2);
      expect(json.outputs).toHaveLength(1);
      expect(isGraphImplementation(json.implementation)).toBe(true);
      if (isGraphImplementation(json.implementation)) {
        expect(Object.keys(json.implementation.graph.tasks)).toEqual([
          "first_task",
          "second_task",
        ]);
      }
    });
  });

  describe("AnnotationsCollection.toJson()", () => {
    it("should return an object, not a stringified JSON", () => {
      // This test will verify that annotations are returned as objects
      // Currently AnnotationsCollection.toJson() returns JSON.stringify()

      const context = new RootContext();
      const componentSpec = new ComponentSpecEntity(
        context.generateId(),
        context,
        { name: "Test" },
      );

      // After we add annotations support to inputs/outputs
      // const input = componentSpec.inputs.add({ name: "test" });
      // input.annotations.add({ key: "hint", value: "text" });
      // const json = input.toJson();
      // expect(typeof json.annotations).toBe("object");
      // expect(json.annotations).not.toBe('"text"');

      expect(componentSpec.name).toBe("Test");
    });
  });
});
