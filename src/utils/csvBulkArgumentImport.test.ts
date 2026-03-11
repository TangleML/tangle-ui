import { describe, expect, it } from "vitest";

import type { DynamicDataArgument, InputSpec } from "./componentSpec";
import { mapCsvToArguments, parseCsv } from "./csvBulkArgumentImport";

function makeSecretArg(name: string): DynamicDataArgument {
  return { dynamicData: { secret: { name } } };
}

function makeInput(name: string, optional = false): InputSpec {
  return { name, optional };
}

describe("parseCsv", () => {
  it("parses simple CSV", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('name,value\n"Smith, John",42')).toEqual([
      ["name", "value"],
      ["Smith, John", "42"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([["a"], ['he said "hi"']]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("parses header-only CSV", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("handles Windows line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("trims whitespace on unquoted fields", () => {
    expect(parseCsv("  a , b \n 1 , 2 ")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles multiple data rows", () => {
    expect(parseCsv("x,y\n1,2\n3,4\n5,6")).toEqual([
      ["x", "y"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("handles mixed quoted and unquoted fields", () => {
    expect(parseCsv('a,b,c\nplain,"has, comma",plain2')).toEqual([
      ["a", "b", "c"],
      ["plain", "has, comma", "plain2"],
    ]);
  });
});

describe("mapCsvToArguments", () => {
  const inputs = [
    makeInput("dataset"),
    makeInput("model"),
    makeInput("lr", true),
  ];

  it("populates values from single-row CSV", () => {
    const csv = "dataset,model\ntrain.csv,random_forest";
    const result = mapCsvToArguments(csv, inputs, { dataset: "", model: "" });

    expect(result.values).toEqual({
      dataset: "train.csv",
      model: "random_forest",
    });
    expect(result.enableBulk).toBe(false);
    expect(result.rowCount).toBe(1);
  });

  it("joins multi-row CSV values with comma-space for bulk mode", () => {
    const csv = "dataset,model\ntrain.csv,rf\ntest.csv,gb\nval.csv,nn";
    const result = mapCsvToArguments(csv, inputs, { dataset: "", model: "" });

    expect(result.values).toEqual({
      dataset: "train.csv, test.csv, val.csv",
      model: "rf, gb, nn",
    });
    expect(result.enableBulk).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it("reports unmatched columns", () => {
    const csv = "dataset,unknown_col\ntrain.csv,foo";
    const result = mapCsvToArguments(csv, inputs, { dataset: "" });

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect(result.unmatchedColumns).toEqual(["unknown_col"]);
  });

  it("skips secret inputs", () => {
    const csv = "dataset,api_key\ntrain.csv,sk-123";
    const inputsWithSecret = [...inputs, makeInput("api_key")];
    const currentArgs = { dataset: "", api_key: makeSecretArg("my-secret") };
    const result = mapCsvToArguments(csv, inputsWithSecret, currentArgs);

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect(result.skippedSecretInputs).toEqual(["api_key"]);
  });

  it("leaves inputs not in CSV unchanged", () => {
    const csv = "dataset\ntrain.csv";
    const result = mapCsvToArguments(csv, inputs, {
      dataset: "",
      model: "existing",
    });

    expect(result.values).toEqual({ dataset: "train.csv" });
    expect("model" in result.values).toBe(false);
  });

  it("tracks only changed input names", () => {
    const csv = "dataset,model\ntrain.csv,rf";
    const result = mapCsvToArguments(csv, inputs, {
      dataset: "train.csv",
      model: "",
    });

    expect(result.changedInputNames).toEqual(["model"]);
  });

  it("returns empty result for empty CSV", () => {
    const result = mapCsvToArguments("", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(0);
  });

  it("returns empty result for header-only CSV", () => {
    const result = mapCsvToArguments("dataset,model", inputs, {});

    expect(result.values).toEqual({});
    expect(result.rowCount).toBe(0);
  });

  it("reports all columns as unmatched when none match", () => {
    const csv = "foo,bar\n1,2";
    const result = mapCsvToArguments(csv, inputs, {});

    expect(result.values).toEqual({});
    expect(result.unmatchedColumns).toEqual(["foo", "bar"]);
  });
});
