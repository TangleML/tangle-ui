import { describe, expect, it } from "vitest";

import {
  expandBulkArguments,
  getBulkRunCount,
  parseBulkValues,
} from "./bulkSubmission";
import type { DynamicDataArgument } from "./componentSpec";

function makeSecretArg(name: string): DynamicDataArgument {
  return { dynamicData: { secret: { name } } };
}

describe("parseBulkValues", () => {
  it("splits comma-separated values and trims whitespace", () => {
    expect(parseBulkValues("A, B, C, D")).toEqual(["A", "B", "C", "D"]);
  });

  it("returns a single value when no commas", () => {
    expect(parseBulkValues("hello")).toEqual(["hello"]);
  });

  it("filters out empty values from trailing commas", () => {
    expect(parseBulkValues("A, B, ")).toEqual(["A", "B"]);
  });

  it("filters out empty values from consecutive commas", () => {
    expect(parseBulkValues("A, , B")).toEqual(["A", "B"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseBulkValues("")).toEqual([]);
  });

  it("returns empty array for only whitespace and commas", () => {
    expect(parseBulkValues(" , , ")).toEqual([]);
  });

  it("handles values with internal spaces", () => {
    expect(parseBulkValues("hello world, foo bar")).toEqual([
      "hello world",
      "foo bar",
    ]);
  });

  it("does not split on commas inside JSON objects", () => {
    expect(parseBulkValues('{"a":1,"b":2}, {"a":3,"b":4}')).toEqual([
      '{"a":1,"b":2}',
      '{"a":3,"b":4}',
    ]);
  });

  it("does not split on commas inside JSON arrays", () => {
    expect(parseBulkValues("[1,2,3], [4,5,6]")).toEqual(["[1,2,3]", "[4,5,6]"]);
  });

  it("does not split on commas inside nested structures", () => {
    expect(
      parseBulkValues(
        '{"config":{"lr":0.01,"epochs":100}}, {"config":{"lr":0.02,"epochs":200}}',
      ),
    ).toEqual([
      '{"config":{"lr":0.01,"epochs":100}}',
      '{"config":{"lr":0.02,"epochs":200}}',
    ]);
  });

  it("handles mix of plain values and JSON objects", () => {
    expect(parseBulkValues('simple, {"key":"value"}, plain')).toEqual([
      "simple",
      '{"key":"value"}',
      "plain",
    ]);
  });

  it("unquotes JSON-quoted values that contain commas", () => {
    expect(parseBulkValues('"hello, world", "foo, bar"')).toEqual([
      "hello, world",
      "foo, bar",
    ]);
  });

  it("unquotes mixed quoted and unquoted values", () => {
    expect(parseBulkValues('simple, "has, comma", plain')).toEqual([
      "simple",
      "has, comma",
      "plain",
    ]);
  });

  it("treats an opening quote as starting a quoted value", () => {
    // An unclosed quote consumes the rest of the string as one value
    expect(parseBulkValues('"incomplete, normal')).toEqual([
      '"incomplete, normal',
    ]);
  });

  it("handles quoted values with escaped quotes inside", () => {
    expect(parseBulkValues('"say \\"hello, world\\"", other')).toEqual([
      'say "hello, world"',
      "other",
    ]);
  });
});

describe("expandBulkArguments", () => {
  it("returns single-element array when no bulk inputs", () => {
    const args = { input1: "value1", input2: "value2" };
    const result = expandBulkArguments(args, new Set());
    expect(result).toEqual([args]);
  });

  it("expands a single bulk input into multiple argument sets", () => {
    const args = { dataset: "train, test, val", model: "rf" };
    const result = expandBulkArguments(args, new Set(["dataset"]));
    expect(result).toEqual([
      { dataset: "train", model: "rf" },
      { dataset: "test", model: "rf" },
      { dataset: "val", model: "rf" },
    ]);
  });

  it("expands two bulk inputs with matching counts", () => {
    const args = { dataset: "train, test", lr: "0.01, 0.001" };
    const result = expandBulkArguments(args, new Set(["dataset", "lr"]));
    expect(result).toEqual([
      { dataset: "train", lr: "0.01" },
      { dataset: "test", lr: "0.001" },
    ]);
  });

  it("throws when bulk input counts differ", () => {
    const args = { dataset: "A, B, C", lr: "0.01, 0.001" };
    expect(() => expandBulkArguments(args, new Set(["dataset", "lr"]))).toThrow(
      "Bulk inputs have different value counts",
    );
  });

  it("preserves non-string arguments (secrets) as-is", () => {
    const secretArg = makeSecretArg("my-secret");
    const args = { dataset: "train, test", api_key: secretArg };
    const result = expandBulkArguments(args, new Set(["dataset"]));
    expect(result).toEqual([
      { dataset: "train", api_key: secretArg },
      { dataset: "test", api_key: secretArg },
    ]);
  });

  it("ignores non-string values in bulk input names", () => {
    const secretArg = makeSecretArg("my-secret");
    const args = { api_key: secretArg, dataset: "single" };
    const result = expandBulkArguments(args, new Set(["api_key"]));
    expect(result).toEqual([args]);
  });
});

describe("getBulkRunCount", () => {
  it("returns 1 when no bulk inputs", () => {
    expect(getBulkRunCount({ a: "val" }, new Set())).toBe(1);
  });

  it("returns correct count for single bulk input", () => {
    expect(getBulkRunCount({ a: "x, y, z" }, new Set(["a"]))).toBe(3);
  });

  it("returns correct count for multiple matching bulk inputs", () => {
    expect(getBulkRunCount({ a: "x, y", b: "1, 2" }, new Set(["a", "b"]))).toBe(
      2,
    );
  });

  it("returns -1 for mismatched bulk input counts", () => {
    expect(
      getBulkRunCount({ a: "x, y, z", b: "1, 2" }, new Set(["a", "b"])),
    ).toBe(-1);
  });

  it("returns 1 when bulk input is non-string", () => {
    expect(getBulkRunCount({ a: makeSecretArg("s") }, new Set(["a"]))).toBe(1);
  });

  it("returns 0 for empty bulk input value", () => {
    expect(getBulkRunCount({ a: "" }, new Set(["a"]))).toBe(0);
  });
});
