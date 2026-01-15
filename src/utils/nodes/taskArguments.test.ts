import { describe, expect, it } from "vitest";

import type { GraphInputArgument, TaskOutputArgument } from "@/api/types.gen";
import type { ComponentSpec } from "@/utils/componentSpec";

import { extractTaskArguments, getArgumentValue } from "./taskArguments";

describe("taskArguments", () => {
  describe("getArgumentValue", () => {
    it("should return undefined when inputName is undefined", () => {
      const taskArguments = { input1: "value1" };

      expect(getArgumentValue(taskArguments, undefined)).toBeUndefined();
    });

    it("should return undefined when inputName is empty string", () => {
      const taskArguments = { input1: "value1" };

      expect(getArgumentValue(taskArguments, "")).toBeUndefined();
    });

    it("should return undefined when taskArguments is undefined", () => {
      expect(getArgumentValue(undefined, "input1")).toBeUndefined();
    });

    it("should return undefined when argument does not exist", () => {
      const taskArguments = { input1: "value1" };

      expect(getArgumentValue(taskArguments, "nonexistent")).toBeUndefined();
    });

    it("should return the string value when argument is a string", () => {
      const taskArguments = {
        input1: "value1",
        input2: "value2",
      };

      expect(getArgumentValue(taskArguments, "input1")).toBe("value1");
      expect(getArgumentValue(taskArguments, "input2")).toBe("value2");
    });

    it("should return undefined when argument is a GraphInputArgument", () => {
      const graphInputArgument: GraphInputArgument = {
        graphInput: { inputName: "pipeline_input" },
      };
      const taskArguments = {
        input1: graphInputArgument,
      };

      expect(getArgumentValue(taskArguments, "input1")).toBeUndefined();
    });

    it("should return undefined when argument is a TaskOutputArgument", () => {
      const taskOutputArgument: TaskOutputArgument = {
        taskOutput: { outputName: "output", taskId: "task1" },
      };
      const taskArguments = {
        input1: taskOutputArgument,
      };

      expect(getArgumentValue(taskArguments, "input1")).toBeUndefined();
    });

    it("should handle mixed argument types and return only string values", () => {
      const graphInputArgument: GraphInputArgument = {
        graphInput: { inputName: "pipeline_input" },
      };
      const taskOutputArgument: TaskOutputArgument = {
        taskOutput: { outputName: "output", taskId: "task1" },
      };
      const taskArguments = {
        stringArg: "string_value",
        graphArg: graphInputArgument,
        taskArg: taskOutputArgument,
      };

      expect(getArgumentValue(taskArguments, "stringArg")).toBe("string_value");
      expect(getArgumentValue(taskArguments, "graphArg")).toBeUndefined();
      expect(getArgumentValue(taskArguments, "taskArg")).toBeUndefined();
    });
  });

  describe("extractTaskArguments", () => {
    it("should return empty object when taskArguments is undefined", () => {
      expect(extractTaskArguments(undefined)).toEqual({});
    });

    it("should return empty object when taskArguments is null", () => {
      expect(extractTaskArguments(null)).toEqual({});
    });

    it("should return empty object when taskArguments is empty", () => {
      expect(extractTaskArguments({})).toEqual({});
    });

    it("should return all string arguments", () => {
      const taskArguments = {
        input1: "value1",
        input2: "value2",
        input3: "value3",
      };

      expect(extractTaskArguments(taskArguments)).toEqual({
        input1: "value1",
        input2: "value2",
        input3: "value3",
      });
    });

    it("should filter out GraphInputArgument values", () => {
      const graphInputArgument: GraphInputArgument = {
        graphInput: { inputName: "pipeline_input" },
      };
      const taskArguments = {
        stringArg: "value1",
        graphArg: graphInputArgument,
      };

      expect(extractTaskArguments(taskArguments)).toEqual({
        stringArg: "value1",
      });
    });

    it("should filter out TaskOutputArgument values", () => {
      const taskOutputArgument: TaskOutputArgument = {
        taskOutput: { outputName: "output", taskId: "task1" },
      };
      const taskArguments = {
        stringArg: "value1",
        taskArg: taskOutputArgument,
      };

      expect(extractTaskArguments(taskArguments)).toEqual({
        stringArg: "value1",
      });
    });

    it("should filter out all non-string arguments", () => {
      const graphInputArgument: GraphInputArgument = {
        graphInput: { inputName: "pipeline_input" },
      };
      const taskOutputArgument: TaskOutputArgument = {
        taskOutput: { outputName: "output", taskId: "task1" },
      };
      const taskArguments = {
        stringArg1: "value1",
        graphArg: graphInputArgument,
        stringArg2: "value2",
        taskArg: taskOutputArgument,
      };

      expect(extractTaskArguments(taskArguments)).toEqual({
        stringArg1: "value1",
        stringArg2: "value2",
      });
    });

    describe("with componentSpec", () => {
      const minimalImplementation: ComponentSpec["implementation"] = {
        container: { image: "test-image", command: ["echo"] },
      };

      it("should only include arguments that match component inputs", () => {
        const taskArguments = {
          input1: "value1",
          input2: "value2",
          extraArg: "extraValue",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          inputs: [{ name: "input1" }, { name: "input2" }],
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({
          input1: "value1",
          input2: "value2",
        });
      });

      it("should exclude arguments not in component inputs", () => {
        const taskArguments = {
          input1: "value1",
          unknownArg: "unknownValue",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          inputs: [{ name: "input1" }],
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({
          input1: "value1",
        });
      });

      it("should return empty object when componentSpec has no inputs", () => {
        const taskArguments = {
          input1: "value1",
          input2: "value2",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({});
      });

      it("should return empty object when componentSpec has empty inputs array", () => {
        const taskArguments = {
          input1: "value1",
          input2: "value2",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          inputs: [],
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({});
      });

      it("should filter both by componentSpec inputs and non-string values", () => {
        const graphInputArgument: GraphInputArgument = {
          graphInput: { inputName: "pipeline_input" },
        };
        const taskArguments = {
          validInput: "validValue",
          graphArg: graphInputArgument,
          unknownArg: "unknownValue",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          inputs: [{ name: "validInput" }, { name: "graphArg" }],
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({
          validInput: "validValue",
        });
      });

      it("should return matching arguments when only some exist in taskArguments", () => {
        const taskArguments = {
          input1: "value1",
        };
        const componentSpec: ComponentSpec = {
          name: "test-component",
          inputs: [{ name: "input1" }, { name: "input2" }, { name: "input3" }],
          implementation: minimalImplementation,
        };

        expect(extractTaskArguments(taskArguments, componentSpec)).toEqual({
          input1: "value1",
        });
      });
    });
  });
});
