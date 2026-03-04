import { describe, expect, it } from "vitest";

import type { DynamicDataArgument, InputSpec } from "./componentSpec";
import { mapJsonToArguments } from "./jsonBulkArgumentImport";

function makeSecretArg(name: string): DynamicDataArgument {
  return { dynamicData: { secret: { name } } };
}

function makeInput(name: string, optional = false): InputSpec {
  return { name, optional };
}

describe("mapJsonToArguments", () => {
  const inputs = [
    makeInput("dataset"),
    makeInput("model"),
    makeInput("lr", true),
  ];

  it("populates values from single object", () => {
    const json = JSON.stringify({ dataset: "train.csv", model: "rf" });
    const result = mapJsonToArguments(json, inputs, { dataset: "", model: "" });

    expect(result.values).toEqual({ dataset: "train.csv", model: "rf" });
    expect(result.enableBulk).toBe(false);
    expect(result.rowCount).toBe(1);
  });

  it("joins array elements for bulk mode", () => {
    const json = JSON.stringify([
      { dataset: "train.csv", model: "rf" },
      { dataset: "test.csv", model: "gb" },
      { dataset: "val.csv", model: "nn" },
    ]);
    const result = mapJsonToArguments(json, inputs, { dataset: "", model: "" });

    expect(result.values).toEqual({
      dataset: "train.csv, test.csv, val.csv",
      model: "rf, gb, nn",
    });
    expect(result.enableBulk).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it("JSON.stringifies object values", () => {
    const json = JSON.stringify({
      dataset: "train.csv",
      model: { type: "rf", depth: 5 },
    });
    const result = mapJsonToArguments(json, inputs, { dataset: "", model: "" });

    expect(result.values.model).toBe('{"type":"rf","depth":5}');
  });

  it("JSON.stringifies number values", () => {
    const json = JSON.stringify({ lr: 0.01 });
    const result = mapJsonToArguments(json, inputs, {});

    expect(result.values.lr).toBe("0.01");
  });

  it("JSON.stringifies array values", () => {
    const json = JSON.stringify({ dataset: [1, 2, 3] });
    const result = mapJsonToArguments(json, inputs, {});

    expect(result.values.dataset).toBe("[1,2,3]");
  });

  it("handles mixed string and object values across bulk rows", () => {
    const json = JSON.stringify([
      { model: "simple" },
      { model: { type: "complex", layers: 3 } },
    ]);
    const result = mapJsonToArguments(json, inputs, { model: "" });

    expect(result.values.model).toBe('simple, {"type":"complex","layers":3}');
    expect(result.enableBulk).toBe(true);
  });

  it("reports unmatched keys", () => {
    const json = JSON.stringify({ dataset: "train.csv", unknown_key: "foo" });
    const result = mapJsonToArguments(json, inputs, { dataset: "" });

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect(result.unmatchedColumns).toEqual(["unknown_key"]);
  });

  it("skips secret inputs", () => {
    const json = JSON.stringify({ dataset: "train.csv", api_key: "sk-123" });
    const inputsWithSecret = [...inputs, makeInput("api_key")];
    const currentArgs = { dataset: "", api_key: makeSecretArg("my-secret") };
    const result = mapJsonToArguments(json, inputsWithSecret, currentArgs);

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect(result.skippedSecretInputs).toEqual(["api_key"]);
  });

  it("tracks only changed input names", () => {
    const json = JSON.stringify({ dataset: "train.csv", model: "rf" });
    const result = mapJsonToArguments(json, inputs, {
      dataset: "train.csv",
      model: "",
    });

    expect(result.changedInputNames).toEqual(["model"]);
  });

  it("does not include inputs not present in JSON", () => {
    const json = JSON.stringify({ dataset: "train.csv" });
    const result = mapJsonToArguments(json, inputs, {
      dataset: "",
      model: "existing",
    });

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect("model" in result.values).toBe(false);
  });

  it("treats null values as empty strings", () => {
    const json = JSON.stringify({ dataset: null });
    const result = mapJsonToArguments(json, inputs, { dataset: "old" });

    expect(result.values.dataset).toBe("");
  });

  it("uses empty string for keys missing in some rows", () => {
    const json = JSON.stringify([
      { dataset: "a", model: "x" },
      { dataset: "b" },
    ]);
    const result = mapJsonToArguments(json, inputs, { dataset: "", model: "" });

    expect(result.values.dataset).toBe("a, b");
    expect(result.values.model).toBe("x, ");
  });

  it("returns empty result for invalid JSON", () => {
    const result = mapJsonToArguments("not valid json{", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(0);
  });

  it("returns empty result for non-object JSON", () => {
    expect(mapJsonToArguments('"just a string"', inputs, {}).rowCount).toBe(0);
    expect(mapJsonToArguments("42", inputs, {}).rowCount).toBe(0);
    expect(mapJsonToArguments("true", inputs, {}).rowCount).toBe(0);
  });

  it("returns empty result for array of non-objects", () => {
    const result = mapJsonToArguments("[1, 2, 3]", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(0);
  });

  it("returns empty result for empty array", () => {
    const result = mapJsonToArguments("[]", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(0);
  });

  it("handles empty object with rowCount 1", () => {
    const result = mapJsonToArguments("{}", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(1);
  });

  it("quotes string values containing commas for bulk round-trip", () => {
    const inputsWithScript = [...inputs, makeInput("script")];
    const json = JSON.stringify([
      { script: "train(lr=0.01, epochs=100)" },
      { script: "train(lr=0.02, epochs=200)" },
    ]);
    const result = mapJsonToArguments(json, inputsWithScript, { script: "" });

    // Values are quoted so parseBulkValues won't split on internal commas
    expect(result.values.script).toBe(
      '"train(lr=0.01, epochs=100)", "train(lr=0.02, epochs=200)"',
    );
    expect(result.rowCount).toBe(2);
  });

  it("does not quote string values without commas in bulk", () => {
    const json = JSON.stringify([
      { dataset: "train.csv" },
      { dataset: "test.csv" },
    ]);
    const result = mapJsonToArguments(json, inputs, { dataset: "" });

    expect(result.values.dataset).toBe("train.csv, test.csv");
  });
});
