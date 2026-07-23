import { describe, expect, it } from "vitest";

import { isRecord } from "./typeGuards";

describe("isRecord()", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1, b: "two" })).toBe(true);
  });

  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(true)).toBe(false);
  });

  it("narrows the type so property access is allowed", () => {
    const value: unknown = { hello: "world" };
    if (isRecord(value)) {
      // If this compiles, the guard narrowed `value` to Record<string, unknown>.
      expect(value.hello).toBe("world");
    } else {
      throw new Error("expected value to be narrowed to a record");
    }
  });
});
