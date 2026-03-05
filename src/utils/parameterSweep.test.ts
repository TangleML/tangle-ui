import { describe, expect, it } from "vitest";

import {
  expandSweep,
  getSweepRunCount,
  parseRange,
  type SweepParameter,
  validateSweep,
} from "./parameterSweep";

describe("expandSweep", () => {
  const baseArgs = { lr: "0.01", batch_size: "32", model: "resnet" };

  it("returns base arguments when no sweep params have values", () => {
    const params: SweepParameter[] = [{ name: "lr", values: [] }];
    expect(expandSweep(baseArgs, params)).toEqual([baseArgs]);
  });

  it("generates cartesian product for single parameter", () => {
    const params: SweepParameter[] = [
      { name: "lr", values: ["0.001", "0.01", "0.1"] },
    ];
    const result = expandSweep(baseArgs, params);
    expect(result).toEqual([
      { ...baseArgs, lr: "0.001" },
      { ...baseArgs, lr: "0.01" },
      { ...baseArgs, lr: "0.1" },
    ]);
  });

  it("generates cartesian product for multiple parameters", () => {
    const params: SweepParameter[] = [
      { name: "lr", values: ["0.001", "0.01"] },
      { name: "batch_size", values: ["32", "64"] },
    ];
    const result = expandSweep(baseArgs, params);
    expect(result).toHaveLength(4);
    expect(result).toEqual([
      { ...baseArgs, lr: "0.001", batch_size: "32" },
      { ...baseArgs, lr: "0.001", batch_size: "64" },
      { ...baseArgs, lr: "0.01", batch_size: "32" },
      { ...baseArgs, lr: "0.01", batch_size: "64" },
    ]);
  });

  it("generates cartesian product for three parameters", () => {
    const params: SweepParameter[] = [
      { name: "lr", values: ["0.001", "0.01"] },
      { name: "batch_size", values: ["32", "64"] },
      { name: "model", values: ["resnet", "vgg"] },
    ];
    const result = expandSweep(baseArgs, params);
    expect(result).toHaveLength(8);
  });

  it("skips params with no values", () => {
    const params: SweepParameter[] = [
      { name: "lr", values: ["0.001", "0.01"] },
      { name: "batch_size", values: [] },
    ];
    const result = expandSweep(baseArgs, params);
    expect(result).toHaveLength(2);
    expect(result[0].batch_size).toBe("32");
  });
});

describe("getSweepRunCount", () => {
  it("returns 0 when no params have values", () => {
    expect(getSweepRunCount([])).toBe(0);
  });

  it("returns product of value counts", () => {
    const params: SweepParameter[] = [
      { name: "a", values: ["1", "2", "3"] },
      { name: "b", values: ["x", "y"] },
    ];
    expect(getSweepRunCount(params)).toBe(6);
  });

  it("ignores params with no values", () => {
    const params: SweepParameter[] = [
      { name: "a", values: ["1", "2"] },
      { name: "b", values: [] },
    ];
    expect(getSweepRunCount(params)).toBe(2);
  });
});

describe("validateSweep", () => {
  it("returns error when no params have values", () => {
    const result = validateSweep([{ name: "a", values: [] }]);
    expect(result).toContain("Add at least one value");
  });

  it("returns error for empty string values", () => {
    const result = validateSweep([{ name: "a", values: ["good", " "] }]);
    expect(result).toContain("Empty values");
  });

  it("returns error when exceeding max runs", () => {
    const params: SweepParameter[] = [
      { name: "a", values: Array.from({ length: 50 }, (_, i) => String(i)) },
      { name: "b", values: Array.from({ length: 50 }, (_, i) => String(i)) },
    ];
    const result = validateSweep(params);
    expect(result).toContain("exceeds the maximum");
  });

  it("returns null for valid configuration", () => {
    const result = validateSweep([
      { name: "a", values: ["1", "2"] },
      { name: "b", values: ["x", "y"] },
    ]);
    expect(result).toBeNull();
  });
});

describe("parseRange", () => {
  it("returns null for non-range strings", () => {
    expect(parseRange("hello")).toBeNull();
    expect(parseRange("1,2,3")).toBeNull();
  });

  it("generates linear range with default steps", () => {
    const result = parseRange("0..1");
    expect(result).toHaveLength(5);
    expect(result?.[0]).toBe("0");
    expect(result?.[4]).toBe("1");
  });

  it("generates linear range with custom steps", () => {
    const result = parseRange("0..10 linear 3");
    expect(result).toEqual(["0", "5", "10"]);
  });

  it("generates log range", () => {
    const result = parseRange("0.001..1 log 4");
    expect(result).toHaveLength(4);
    expect(result?.[0]).toBe("0.001");
    expect(result?.[3]).toBe("1");
  });

  it("returns null for log range with non-positive values", () => {
    expect(parseRange("0..1 log 5")).toBeNull();
    expect(parseRange("-1..1 log 5")).toBeNull();
  });

  it("returns null when steps < 2", () => {
    expect(parseRange("0..1 linear 1")).toBeNull();
  });

  it("handles negative values in linear range", () => {
    const result = parseRange("-1..1 linear 3");
    expect(result).toEqual(["-1", "0", "1"]);
  });
});
