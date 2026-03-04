import { describe, expect, it } from "vitest";

import type { InputSpec } from "./componentSpec";
import {
  generateCsvTemplate,
  generateJsonTemplate,
  generateYamlTemplate,
} from "./templateExport";
import { makeInput, makeSecretArg } from "./testHelpers";

describe("generateCsvTemplate", () => {
  const inputs = [
    makeInput("dataset"),
    makeInput("model"),
    makeInput("lr", true),
  ];

  it("generates headers with empty defaults", () => {
    expect(generateCsvTemplate(inputs, {})).toBe("dataset,model,lr\n,,");
  });

  it("uses current argument values as defaults", () => {
    const args = { dataset: "train.csv", model: "", lr: "" };
    expect(generateCsvTemplate(inputs, args)).toBe(
      "dataset,model,lr\ntrain.csv,,",
    );
  });

  it("uses input default when no current value", () => {
    const inputsWithDefaults: InputSpec[] = [
      { name: "dataset", default: "data.csv" },
      { name: "model" },
    ];
    expect(generateCsvTemplate(inputsWithDefaults, {})).toBe(
      "dataset,model\ndata.csv,",
    );
  });

  it("skips secret inputs", () => {
    const args = { dataset: "", model: "", api_key: makeSecretArg("s") };
    const inputsWithSecret = [...inputs, makeInput("api_key")];
    expect(generateCsvTemplate(inputsWithSecret, args)).toBe(
      "dataset,model,lr\n,,",
    );
  });

  it("returns empty string when all inputs are secrets", () => {
    const secretInputs = [makeInput("api_key")];
    const args = { api_key: makeSecretArg("s") };
    expect(generateCsvTemplate(secretInputs, args)).toBe("");
  });

  it("expands bulk inputs into separate rows", () => {
    const args = { dataset: "train, test, val", model: "rf", lr: "0.01" };
    const bulk = new Set(["dataset"]);
    expect(generateCsvTemplate(inputs, args, bulk)).toBe(
      "dataset,model,lr\ntrain,rf,0.01\ntest,rf,0.01\nval,rf,0.01",
    );
  });

  it("expands multiple bulk inputs in parallel", () => {
    const args = { dataset: "train, test", model: "rf, gb", lr: "0.01" };
    const bulk = new Set(["dataset", "model"]);
    expect(generateCsvTemplate(inputs, args, bulk)).toBe(
      "dataset,model,lr\ntrain,rf,0.01\ntest,gb,0.01",
    );
  });

  it("quotes values that contain commas", () => {
    const args = { dataset: "a,b", model: "rf" };
    expect(generateCsvTemplate(inputs, args)).toBe(
      'dataset,model,lr\n"a,b",rf,',
    );
  });
});

describe("generateJsonTemplate", () => {
  const inputs = [
    makeInput("dataset"),
    makeInput("model"),
    makeInput("lr", true),
  ];

  it("generates single object for non-bulk values", () => {
    const args = { dataset: "train.csv", model: "rf", lr: "" };
    const result = JSON.parse(generateJsonTemplate(inputs, args));

    expect(result).toEqual({ dataset: "train.csv", model: "rf", lr: "" });
  });

  it("generates array of objects for bulk values", () => {
    const args = { dataset: "train, test, val", model: "rf", lr: "0.01" };
    const bulk = new Set(["dataset"]);
    const result = JSON.parse(generateJsonTemplate(inputs, args, bulk));

    expect(result).toEqual([
      { dataset: "train", model: "rf", lr: "0.01" },
      { dataset: "test", model: "rf", lr: "0.01" },
      { dataset: "val", model: "rf", lr: "0.01" },
    ]);
  });

  it("skips secret inputs", () => {
    const args = { dataset: "train.csv", api_key: makeSecretArg("s") };
    const inputsWithSecret = [...inputs, makeInput("api_key")];
    const result = JSON.parse(generateJsonTemplate(inputsWithSecret, args));

    expect(result).toEqual({ dataset: "train.csv", model: "", lr: "" });
    expect("api_key" in result).toBe(false);
  });

  it("returns empty string when all inputs are secrets", () => {
    const secretInputs = [makeInput("api_key")];
    const args = { api_key: makeSecretArg("s") };
    expect(generateJsonTemplate(secretInputs, args)).toBe("");
  });

  it("uses input defaults when no current value", () => {
    const inputsWithDefaults: InputSpec[] = [
      { name: "dataset", default: "data.csv" },
      { name: "model" },
    ];
    const result = JSON.parse(generateJsonTemplate(inputsWithDefaults, {}));

    expect(result).toEqual({ dataset: "data.csv", model: "" });
  });
});

describe("generateYamlTemplate", () => {
  const inputs = [makeInput("dataset"), makeInput("model")];

  it("generates YAML for non-bulk values", () => {
    const args = { dataset: "train.csv", model: "rf" };
    const result = generateYamlTemplate(inputs, args);

    expect(result).toContain("dataset: train.csv");
    expect(result).toContain("model: rf");
  });

  it("generates YAML array for bulk values", () => {
    const args = { dataset: "train, test", model: "rf" };
    const bulk = new Set(["dataset"]);
    const result = generateYamlTemplate(inputs, args, bulk);

    expect(result).toContain("- dataset: train");
    expect(result).toContain("- dataset: test");
  });

  it("returns empty string when all inputs are secrets", () => {
    const secretInputs = [makeInput("api_key")];
    const args = { api_key: makeSecretArg("s") };
    expect(generateYamlTemplate(secretInputs, args)).toBe("");
  });
});
