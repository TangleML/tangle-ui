import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ComponentSpec } from "./componentSpec";
import {
  checkComponentSpecValidity,
  checkComponentSpecValidityRecursive,
} from "./validations";

// Mock the componentSpec module
vi.mock("./componentSpec", () => ({
  isGraphImplementation: vi.fn(),
}));

const { isGraphImplementation } = await import("./componentSpec");

describe("checkComponentSpecValidity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Component Spec Validation", () => {
    it("should return error for null component spec", () => {
      const result = checkComponentSpecValidity(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Component spec is null or undefined");
    });

    it("should return error for undefined component spec", () => {
      const result = checkComponentSpecValidity(undefined as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Component spec is null or undefined");
    });

    it("should return error for empty component name", () => {
      const componentSpec: ComponentSpec = {
        name: "",
        implementation: { container: { image: "test-image" } },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Component name is required and cannot be empty",
      );
    });

    it("should return error for missing implementation", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: null as any,
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Component implementation is required");
    });
  });

  describe("Input/Output Validation", () => {
    it("should return error for input without name", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        inputs: [{ name: "", type: "string", value: "test-value" }],
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Input with value "test-value" must have a valid name',
      );
    });

    it("should return error for duplicate input names", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        inputs: [
          { name: "duplicate", type: "string", value: "value1" },
          { name: "duplicate", type: "string", value: "value2" },
        ],
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Duplicate input name found: "duplicate"',
      );
    });

    it("should return error for required input without a value", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        inputs: [{ name: "no-value", type: "string", optional: false }],
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Pipeline input "no-value" is required and does not have a value',
      );
    });

    it("should return error for output without name", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        outputs: [{ name: "", type: "string" }],
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Output with type "string" must have a valid name',
      );
    });

    it("should return error for duplicate output names", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        outputs: [
          { name: "duplicate", type: "string" },
          { name: "duplicate", type: "number" },
        ],
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Duplicate output name found: "duplicate"',
      );
    });
  });

  describe("Non-Graph Implementation", () => {
    it("should skip graph validations for container implementations", () => {
      vi.mocked(isGraphImplementation).mockReturnValue(false);

      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Graph Implementation Validation", () => {
    beforeEach(() => {
      vi.mocked(isGraphImplementation).mockReturnValue(true);
    });

    it("should return error for graph without tasks", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: {
          graph: {
            tasks: {},
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Pipeline must contain at least one task",
      );
    });

    it("should return error for task without componentRef", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: {
          graph: {
            tasks: {
              task1: {} as any,
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task "task1" must have a componentRef');
    });

    it("should validate graph input references", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        inputs: [{ name: "validInput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                  },
                },
                arguments: {
                  arg1: {
                    graphInput: { inputName: "invalidInput" },
                  },
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Task "task1" argument "arg1" references non-existent graph input: "invalidInput"',
      );
    });

    it("should validate task output references", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                  },
                },
                arguments: {
                  arg1: {
                    taskOutput: {
                      taskId: "nonExistentTask",
                      outputName: "output1",
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Task "task1" argument "arg1" references non-existent task: "nonExistentTask"',
      );
    });

    it("should validate required task inputs", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                    inputs: [
                      {
                        name: "requiredInput",
                        type: "string",
                        optional: false,
                      },
                    ],
                  },
                },
                arguments: {},
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Task "task1" is missing required argument for input: "requiredInput"',
      );
    });

    it("should validate graph outputs", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        outputs: [{ name: "validOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                  },
                },
              },
            },
            outputValues: {
              invalidOutput: {
                taskOutput: { taskId: "task1", outputName: "output1" },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Graph output "invalidOutput" is not defined in component outputs',
      );
    });

    it("should validate input-output connections", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        inputs: [{ name: "requiredInput", type: "string" }],
        outputs: [{ name: "requiredOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                  },
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Pipeline input "requiredInput" is not connected to any tasks',
      );
      expect(result.errors).toContain(
        'Pipeline output "requiredOutput" is not connected to any tasks',
      );
    });

    it("should detect circular dependencies", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component-1",
                  spec: {
                    name: "child-component-1",
                    implementation: { container: { image: "child-image-1" } },
                  },
                },
                arguments: {
                  arg1: {
                    taskOutput: { taskId: "task2", outputName: "output1" },
                  },
                },
              },
              task2: {
                componentRef: {
                  name: "child-component-2",
                  spec: {
                    name: "child-component-2",
                    implementation: { container: { image: "child-image-2" } },
                  },
                },
                arguments: {
                  arg1: {
                    taskOutput: { taskId: "task1", outputName: "output1" },
                  },
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Circular dependency detected in pipeline at task: task1",
      );
    });
  });

  describe("Valid Component Spec", () => {
    it("should return valid for a complete valid graph component spec", () => {
      vi.mocked(isGraphImplementation).mockReturnValue(true);

      const componentSpec: ComponentSpec = {
        name: "valid-component",
        inputs: [{ name: "input1", type: "string", value: "value1" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                    inputs: [
                      { name: "taskInput", type: "string", optional: false },
                    ],
                    outputs: [{ name: "taskOutput", type: "string" }],
                  },
                },
                arguments: {
                  taskInput: {
                    graphInput: { inputName: "input1" },
                  },
                },
              },
            },
            outputValues: {
              output1: {
                taskOutput: { taskId: "task1", outputName: "taskOutput" },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return valid for container implementation", () => {
      vi.mocked(isGraphImplementation).mockReturnValue(false);

      const componentSpec: ComponentSpec = {
        name: "function-component",
        inputs: [{ name: "input1", type: "string", default: "default-value" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          container: {
            image: "my-function-image",
            command: ["python", "script.py"],
            args: ["--input", { inputValue: "input1" }],
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle optional inputs correctly", () => {
      vi.mocked(isGraphImplementation).mockReturnValue(false);

      const componentSpec: ComponentSpec = {
        name: "component-with-optional-input",
        inputs: [
          {
            name: "requiredInput",
            type: "string",
            optional: false,
            value: "required",
          },
          { name: "optionalInput", type: "string", optional: true },
          {
            name: "inputWithDefault",
            type: "string",
            default: "default-value",
          },
        ],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          container: {
            image: "test-image",
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Recursive Validation", () => {
    beforeEach(() => {
      // Use real isGraphImplementation for recursive tests
      vi.mocked(isGraphImplementation).mockImplementation((impl: any) => {
        return impl && impl.graph !== undefined;
      });
    });

    it("should validate a simple pipeline without subgraphs", () => {
      const componentSpec: ComponentSpec = {
        name: "root-pipeline",
        inputs: [{ name: "input1", type: "string", value: "value1" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "child-component",
                  spec: {
                    name: "child-component",
                    implementation: { container: { image: "child-image" } },
                    inputs: [{ name: "taskInput", type: "string" }],
                    outputs: [{ name: "taskOutput", type: "string" }],
                  },
                },
                arguments: {
                  taskInput: { graphInput: { inputName: "input1" } },
                },
              },
            },
            outputValues: {
              output1: {
                taskOutput: { taskId: "task1", outputName: "taskOutput" },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(componentSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should recursively validate a pipeline with one level of subgraphs", () => {
      const subgraphSpec: ComponentSpec = {
        name: "subgraph-component",
        inputs: [{ name: "subInput", type: "string", optional: true }],
        outputs: [{ name: "subOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              innerTask: {
                componentRef: {
                  name: "inner-component",
                  spec: {
                    name: "inner-component",
                    implementation: { container: { image: "inner-image" } },
                    inputs: [{ name: "innerInput", type: "string" }],
                    outputs: [{ name: "innerOutput", type: "string" }],
                  },
                },
                arguments: {
                  innerInput: { graphInput: { inputName: "subInput" } },
                },
              },
            },
            outputValues: {
              subOutput: {
                taskOutput: { taskId: "innerTask", outputName: "innerOutput" },
              },
            },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        name: "root-pipeline",
        inputs: [{ name: "rootInput", type: "string", value: "test" }],
        outputs: [{ name: "rootOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              subgraphTask: {
                name: "My Subgraph",
                componentRef: {
                  name: "subgraph-component",
                  spec: subgraphSpec,
                },
                arguments: {
                  subInput: { graphInput: { inputName: "rootInput" } },
                },
              },
            },
            outputValues: {
              rootOutput: {
                taskOutput: {
                  taskId: "subgraphTask",
                  outputName: "subOutput",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(rootSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect errors in nested subgraphs and include proper path", () => {
      const invalidSubgraphSpec: ComponentSpec = {
        name: "invalid-subgraph",
        inputs: [{ name: "subInput", type: "string", optional: true }],
        outputs: [{ name: "subOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              brokenTask: {
                componentRef: {
                  name: "inner-component",
                  spec: {
                    name: "inner-component",
                    implementation: { container: { image: "inner-image" } },
                    inputs: [
                      {
                        name: "requiredInput",
                        type: "string",
                        optional: false,
                      },
                    ],
                    outputs: [{ name: "innerOutput", type: "string" }],
                  },
                },
                // Missing required argument!
                arguments: {},
              },
            },
            outputValues: {
              subOutput: {
                taskOutput: {
                  taskId: "brokenTask",
                  outputName: "innerOutput",
                },
              },
            },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        name: "root-pipeline",
        inputs: [{ name: "rootInput", type: "string", value: "test" }],
        outputs: [{ name: "rootOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              subgraphTask: {
                name: "Broken Subgraph",
                componentRef: {
                  name: "invalid-subgraph",
                  spec: invalidSubgraphSpec,
                },
                arguments: {
                  subInput: { graphInput: { inputName: "rootInput" } },
                },
              },
            },
            outputValues: {
              rootOutput: {
                taskOutput: {
                  taskId: "subgraphTask",
                  outputName: "subOutput",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(rootSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check that the error includes the path to the subgraph
      const errorWithPath = result.errors.find(
        (e) =>
          e.path.includes("Broken Subgraph") &&
          e.message.includes("missing required argument"),
      );
      expect(errorWithPath).toBeDefined();
      expect(errorWithPath?.path).toBe("root-pipeline > Broken Subgraph");
    });

    it("should detect errors at multiple levels (root and nested)", () => {
      const invalidSubgraphSpec: ComponentSpec = {
        name: "invalid-subgraph",
        inputs: [{ name: "subInput", type: "string", optional: true }],
        // Missing outputs but outputValues references them
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "inner-component",
                  spec: {
                    name: "inner-component",
                    implementation: { container: { image: "inner-image" } },
                    outputs: [{ name: "innerOutput", type: "string" }],
                  },
                },
                arguments: {
                  input: { graphInput: { inputName: "subInput" } },
                },
              },
            },
            outputValues: {
              nonExistentOutput: {
                taskOutput: { taskId: "task1", outputName: "innerOutput" },
              },
            },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        name: "root-pipeline",
        inputs: [{ name: "rootInput", type: "string", value: "test" }],
        outputs: [{ name: "rootOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              subgraphTask: {
                name: "Nested Subgraph",
                componentRef: {
                  name: "invalid-subgraph",
                  spec: invalidSubgraphSpec,
                },
                arguments: {
                  subInput: { graphInput: { inputName: "rootInput" } },
                },
              },
              invalidTask: {
                componentRef: {
                  name: "some-component",
                  spec: {
                    name: "some-component",
                    implementation: { container: { image: "some-image" } },
                    inputs: [
                      { name: "required", type: "string", optional: false },
                    ],
                  },
                },
                // Missing required argument at root level!
                arguments: {},
              },
            },
            outputValues: {
              rootOutput: {
                taskOutput: {
                  taskId: "subgraphTask",
                  outputName: "nonExistentOutput",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(rootSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should have errors from both root and subgraph
      const rootErrors = result.errors.filter(
        (e) => e.path === "root-pipeline",
      );
      const subgraphErrors = result.errors.filter((e) =>
        e.path.includes("Nested Subgraph"),
      );

      expect(rootErrors.length).toBeGreaterThan(0);
      expect(subgraphErrors.length).toBeGreaterThan(0);
    });

    it("should handle deeply nested subgraphs (3 levels)", () => {
      // Level 3 (innermost)
      const level3Spec: ComponentSpec = {
        name: "level3",
        inputs: [{ name: "input3", type: "string", optional: true }],
        outputs: [{ name: "output3", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              leaf: {
                componentRef: {
                  name: "leaf-component",
                  spec: {
                    name: "leaf-component",
                    implementation: { container: { image: "leaf-image" } },
                    inputs: [{ name: "leafInput", type: "string" }],
                    outputs: [{ name: "leafOutput", type: "string" }],
                  },
                },
                arguments: {
                  leafInput: { graphInput: { inputName: "input3" } },
                },
              },
            },
            outputValues: {
              output3: {
                taskOutput: { taskId: "leaf", outputName: "leafOutput" },
              },
            },
          },
        },
      };

      // Level 2
      const level2Spec: ComponentSpec = {
        name: "level2",
        inputs: [{ name: "input2", type: "string", optional: true }],
        outputs: [{ name: "output2", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              level3Task: {
                name: "Level 3 Subgraph",
                componentRef: {
                  name: "level3",
                  spec: level3Spec,
                },
                arguments: {
                  input3: { graphInput: { inputName: "input2" } },
                },
              },
            },
            outputValues: {
              output2: {
                taskOutput: {
                  taskId: "level3Task",
                  outputName: "output3",
                },
              },
            },
          },
        },
      };

      // Level 1 (root)
      const level1Spec: ComponentSpec = {
        name: "level1",
        inputs: [{ name: "input1", type: "string", value: "test" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              level2Task: {
                name: "Level 2 Subgraph",
                componentRef: {
                  name: "level2",
                  spec: level2Spec,
                },
                arguments: {
                  input2: { graphInput: { inputName: "input1" } },
                },
              },
            },
            outputValues: {
              output1: {
                taskOutput: {
                  taskId: "level2Task",
                  outputName: "output2",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(level1Spec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect error at the deepest level with full path", () => {
      // Level 3 with error (innermost)
      const level3Spec: ComponentSpec = {
        name: "level3",
        inputs: [{ name: "input3", type: "string", optional: true }],
        outputs: [{ name: "output3", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              brokenLeaf: {
                componentRef: {
                  name: "leaf-component",
                  spec: {
                    name: "leaf-component",
                    implementation: { container: { image: "leaf-image" } },
                    inputs: [
                      {
                        name: "requiredLeafInput",
                        type: "string",
                        optional: false,
                      },
                    ],
                  },
                },
                // Missing required argument!
                arguments: {},
              },
            },
            outputValues: {
              output3: {
                taskOutput: { taskId: "brokenLeaf", outputName: "output" },
              },
            },
          },
        },
      };

      // Level 2
      const level2Spec: ComponentSpec = {
        name: "level2",
        inputs: [{ name: "input2", type: "string", optional: true }],
        outputs: [{ name: "output2", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              level3Task: {
                name: "Deep Subgraph",
                componentRef: {
                  name: "level3",
                  spec: level3Spec,
                },
                arguments: {
                  input3: { graphInput: { inputName: "input2" } },
                },
              },
            },
            outputValues: {
              output2: {
                taskOutput: {
                  taskId: "level3Task",
                  outputName: "output3",
                },
              },
            },
          },
        },
      };

      // Level 1 (root)
      const level1Spec: ComponentSpec = {
        name: "level1",
        inputs: [{ name: "input1", type: "string", value: "test" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              level2Task: {
                name: "Mid Subgraph",
                componentRef: {
                  name: "level2",
                  spec: level2Spec,
                },
                arguments: {
                  input2: { graphInput: { inputName: "input1" } },
                },
              },
            },
            outputValues: {
              output1: {
                taskOutput: {
                  taskId: "level2Task",
                  outputName: "output2",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(level1Spec);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should have error with full path through all levels
      const deepError = result.errors.find((e) =>
        e.path.includes("Deep Subgraph"),
      );
      expect(deepError).toBeDefined();
      expect(deepError?.path).toBe("level1 > Mid Subgraph > Deep Subgraph");
    });

    it("should handle mixed valid and invalid subgraphs", () => {
      const validSubgraph: ComponentSpec = {
        name: "valid-subgraph",
        inputs: [{ name: "validInput", type: "string", optional: true }],
        outputs: [{ name: "validOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              validTask: {
                componentRef: {
                  name: "valid-component",
                  spec: {
                    name: "valid-component",
                    implementation: { container: { image: "valid-image" } },
                    inputs: [{ name: "input", type: "string" }],
                    outputs: [{ name: "output", type: "string" }],
                  },
                },
                arguments: {
                  input: { graphInput: { inputName: "validInput" } },
                },
              },
            },
            outputValues: {
              validOutput: {
                taskOutput: { taskId: "validTask", outputName: "output" },
              },
            },
          },
        },
      };

      const invalidSubgraph: ComponentSpec = {
        name: "invalid-subgraph",
        inputs: [{ name: "invalidInput", type: "string", optional: true }],
        outputs: [{ name: "invalidOutput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              invalidTask: {
                componentRef: {
                  name: "invalid-component",
                  spec: {
                    name: "invalid-component",
                    implementation: { container: { image: "invalid-image" } },
                    inputs: [
                      { name: "required", type: "string", optional: false },
                    ],
                  },
                },
                // Missing required!
                arguments: {},
              },
            },
            outputValues: {
              invalidOutput: {
                taskOutput: { taskId: "invalidTask", outputName: "output" },
              },
            },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        name: "mixed-pipeline",
        inputs: [{ name: "rootInput", type: "string", value: "test" }],
        outputs: [
          { name: "output1", type: "string" },
          { name: "output2", type: "string" },
        ],
        implementation: {
          graph: {
            tasks: {
              validSubgraphTask: {
                name: "Valid Subgraph",
                componentRef: {
                  name: "valid-subgraph",
                  spec: validSubgraph,
                },
                arguments: {
                  validInput: { graphInput: { inputName: "rootInput" } },
                },
              },
              invalidSubgraphTask: {
                name: "Invalid Subgraph",
                componentRef: {
                  name: "invalid-subgraph",
                  spec: invalidSubgraph,
                },
                arguments: {
                  invalidInput: { graphInput: { inputName: "rootInput" } },
                },
              },
            },
            outputValues: {
              output1: {
                taskOutput: {
                  taskId: "validSubgraphTask",
                  outputName: "validOutput",
                },
              },
              output2: {
                taskOutput: {
                  taskId: "invalidSubgraphTask",
                  outputName: "invalidOutput",
                },
              },
            },
          },
        },
      };

      const result = checkComponentSpecValidityRecursive(rootSpec);

      expect(result.isValid).toBe(false);

      // Should only have errors from invalid subgraph
      const invalidErrors = result.errors.filter((e) =>
        e.path.includes("Invalid Subgraph"),
      );
      expect(invalidErrors.length).toBeGreaterThan(0);

      // Should not have errors from valid subgraph
      const validErrors = result.errors.filter((e) =>
        e.path.includes("Valid Subgraph"),
      );
      expect(validErrors).toHaveLength(0);
    });
  });
});
