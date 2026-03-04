import { describe, expect, it } from "vitest";

import {
  BulkCountMismatchError,
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

  it("throws BulkCountMismatchError when counts differ", () => {
    const args = { dataset: "A, B, C", lr: "0.01, 0.001" };
    expect(() => expandBulkArguments(args, new Set(["dataset", "lr"]))).toThrow(
      BulkCountMismatchError,
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
