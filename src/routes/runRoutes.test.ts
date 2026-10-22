import { describe, expect, it } from "vitest";

import { getDefaultRunPath, getRunPath, isRunViewPath } from "./runRoutes";

describe("run routes", () => {
  it("builds run paths, including subgraph executions", () => {
    expect(getRunPath("run 1")).toBe("/runs/run%201");
    expect(getRunPath("run 1", "subgraph 1")).toBe(
      "/runs/run%201/subgraph%201",
    );
  });

  it("opens runs in the run view", () => {
    expect(getDefaultRunPath("run-1")).toBe("/runs/run-1");
  });

  it("tells a run apart from the runs dashboard", () => {
    expect(isRunViewPath("/runs/run-1")).toBe(true);
    expect(isRunViewPath("/runs/run-1/subgraph-1")).toBe(true);
    expect(isRunViewPath("/runs")).toBe(false);
  });
});
