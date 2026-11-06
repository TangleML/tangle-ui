import { describe, expect, it } from "vitest";

import {
  getDefaultRunPath,
  getRunPath,
  getSubgraphExecutionIdFromParams,
  getSubgraphExecutionIdsFromParams,
  isRunViewPath,
} from "./runRoutes";

describe("run routes", () => {
  it("builds run paths, including subgraph executions", () => {
    expect(getRunPath("run 1")).toBe("/runs/run%201");
    expect(getRunPath("run 1", ["subgraph 1"])).toBe(
      "/runs/run%201/subgraph%201",
    );
  });

  it("appends one segment per nested subgraph execution", () => {
    expect(getRunPath("run-1", ["sub-1", "sub-2"])).toBe(
      "/runs/run-1/sub-1/sub-2",
    );
    expect(getRunPath("run-1", ["sub 1", "sub/2"])).toBe(
      "/runs/run-1/sub%201/sub%2F2",
    );
    expect(getRunPath("run-1", [])).toBe("/runs/run-1");
  });

  it("reads the nested subgraph execution chain from route params", () => {
    expect(getSubgraphExecutionIdsFromParams({ id: "run-1" })).toEqual([]);
    expect(
      getSubgraphExecutionIdsFromParams({ id: "run-1", _splat: "sub-1" }),
    ).toEqual(["sub-1"]);
    expect(
      getSubgraphExecutionIdsFromParams({ _splat: "sub-1/sub-2/" }),
    ).toEqual(["sub-1", "sub-2"]);
    expect(getSubgraphExecutionIdFromParams({ _splat: "sub-1/sub-2" })).toBe(
      "sub-2",
    );
    expect(getSubgraphExecutionIdFromParams({ _splat: "" })).toBeUndefined();
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
