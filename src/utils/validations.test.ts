import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ComponentReference,
  type ComponentSpec,
  type GraphImplementation,
  type TaskSpec,
} from "./componentSpec";
import { checkComponentSpecValidity } from "./validations";

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

    it("should skip required input value validation when option enabled", () => {
      const componentSpec: ComponentSpec = {
        name: "test-component",
        implementation: { container: { image: "test-image" } },
        inputs: [{ name: "no-value", type: "string", optional: false }],
      };

      const result = checkComponentSpecValidity(componentSpec, {
        skipInputValueValidation: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain(
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
      vi.mocked(isGraphImplementation).mockImplementation(
        (implementation): implementation is GraphImplementation => {
          return Boolean(
            implementation &&
              typeof implementation === "object" &&
              "graph" in implementation,
          );
        },
      );
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
              // Task intentionally missing componentRef for test
              task1: {} as Partial<TaskSpec> as TaskSpec,
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task "task1" must have a componentRef');
    });

    it("should bubble up subgraph validation errors to parent tasks", () => {
      const invalidSubgraph: ComponentSpec = {
        name: "invalid-subgraph",
        implementation: {
          graph: {
            tasks: {},
          },
        },
      };

      const parentTaskComponentRef: ComponentReference = {
        spec: invalidSubgraph,
      };

      const parentTask: TaskSpec = {
        componentRef: parentTaskComponentRef,
      };

      const componentSpec: ComponentSpec = {
        name: "root-component",
        implementation: {
          graph: {
            tasks: {
              parentTask,
            },
          },
        },
      };

      const result = checkComponentSpecValidity(componentSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Task "parentTask" contains validation errors in its subgraph',
      );
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
      vi.mocked(isGraphImplementation).mockImplementation(
        (implementation): implementation is GraphImplementation =>
          Boolean(
            implementation &&
              typeof implementation === "object" &&
              "graph" in implementation,
          ),
      );

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
});
