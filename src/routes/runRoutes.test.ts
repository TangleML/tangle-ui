import { describe, expect, it } from "vitest";

import { getRunPath } from "./runRoutes";

describe("run routes", () => {
  it("encodes run and subgraph IDs in the canonical route", () => {
    expect(getRunPath("run 1")).toBe("/runs/run%201");
    expect(getRunPath("run/1", "subgraph 1")).toBe(
      "/runs/run%2F1/subgraph%201",
    );
    expect(getRunPath(42)).toBe("/runs/42");
  });
});
