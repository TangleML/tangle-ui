import { describe, expect, it } from "vitest";

import { clamp } from "./math";

describe("clamp()", () => {
  it("returns the value unchanged when it is within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to the lower bound when below min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to the upper bound when above max", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("returns the value as-is when no bounds are given", () => {
    expect(clamp(1234)).toBe(1234);
    expect(clamp(-1234)).toBe(-1234);
  });

  it("applies only the lower bound when max is omitted", () => {
    expect(clamp(-5, 0)).toBe(0);
    expect(clamp(100, 0)).toBe(100);
  });

  it("applies only the upper bound when min is omitted", () => {
    expect(clamp(100, undefined, 10)).toBe(10);
    expect(clamp(-100, undefined, 10)).toBe(-100);
  });

  it("returns the boundary value when equal to a bound", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
