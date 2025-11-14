import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { getArgumentsFromInputs } from "./getArgumentsFromInputs";

describe("getArgumentsFromInputs", () => {
  it("should return empty object when no inputs are defined", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({});
  });

  it("should return arguments for inputs with values", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          value: "value1",
        },
        {
          name: "input2",
          value: "value2",
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      input1: "value1",
      input2: "value2",
    });
  });

  it("should use default value when value is not provided", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          default: "default1",
        },
        {
          name: "input2",
          default: "default2",
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      input1: "default1",
      input2: "default2",
    });
  });

  it("should prefer value over default when both are provided", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          value: "explicit-value",
          default: "default-value",
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      input1: "explicit-value",
    });
  });

  it("should handle mix of inputs with values, defaults, and neither", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          value: "value1",
        },
        {
          name: "input2",
          default: "default2",
        },
        {
          name: "input3",
        },
        {
          name: "input4",
          value: "value4",
          default: "default4",
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      input1: "value1",
      input2: "default2",
      input4: "value4",
    });
  });

  it("should exclude inputs with undefined value and no default", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
        },
        {
          name: "input2",
          value: undefined,
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({});
  });

  it("should exclude inputs with null value and no default", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          value: null as any,
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({});
  });

  it("should include empty string values", () => {
    const componentSpec: ComponentSpec = {
      name: "test-component",
      inputs: [
        {
          name: "input1",
          value: "",
        },
        {
          name: "input2",
          default: "",
        },
      ],
      implementation: { container: { image: "test:latest" } },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      input1: "",
      input2: "",
    });
  });

  it("should handle real-world subgraph scenario", () => {
    // Simulating a subgraph where input nodes have defaults but no explicit values
    const componentSpec: ComponentSpec = {
      name: "financial_data_processor",
      inputs: [
        {
          name: "pdf_url",
          type: "String",
          default: "https://example.com/report.pdf",
        },
        {
          name: "days_ahead",
          type: "Integer",
          default: "30",
          optional: true,
        },
        {
          name: "prediction_column_name",
          type: "String",
          default: "predicted_value",
        },
      ],
      implementation: {
        graph: {
          tasks: {},
        },
      },
    };

    const result = getArgumentsFromInputs(componentSpec);

    expect(result).toEqual({
      pdf_url: "https://example.com/report.pdf",
      days_ahead: "30",
      prediction_column_name: "predicted_value",
    });
  });
});
