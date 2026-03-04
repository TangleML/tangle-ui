import { describe, expect, it } from "vitest";

import type { DynamicDataArgument, InputSpec } from "./componentSpec";
import { generateCsvTemplate } from "./csvBulkArgumentExport";

function makeSecretArg(name: string): DynamicDataArgument {
  return { dynamicData: { secret: { name } } };
}

function makeInput(name: string, optional = false): InputSpec {
  return { name, optional };
}

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
