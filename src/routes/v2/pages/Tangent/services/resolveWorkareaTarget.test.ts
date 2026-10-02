import { describe, expect, it } from "vitest";

import { registerWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";

import {
  coerceWorkareaTarget,
  resolveWorkareaTarget,
} from "./resolveWorkareaTarget";

registerWorkareaKind({
  type: "run",
  icon: "Play",
  keepMounted: true,
  resolveTitle: (target) => `Run ${target.identity}`,
  render: () => null,
});

describe("resolveWorkareaTarget", () => {
  it("defaults the title to the kind's resolveTitle and passes the target through", async () => {
    const target: WorkareaTarget = { type: "run", identity: "id/run-123" };

    const view = await resolveWorkareaTarget(target);

    expect(view).toEqual({ title: "Run id/run-123", target });
  });

  it("prefers an explicit title", async () => {
    const target: WorkareaTarget = { type: "run", identity: "id/run-123" };

    const view = await resolveWorkareaTarget(target, { title: "My Run" });

    expect(view).toEqual({ title: "My Run", target });
  });

  it("throws for a target type with no registered kind", async () => {
    const target: WorkareaTarget = {
      type: "artifact",
      identity: "id/https://host/a.txt",
    };

    await expect(resolveWorkareaTarget(target)).rejects.toThrow(
      /Unsupported workarea target type/,
    );
  });
});

describe("coerceWorkareaTarget", () => {
  it("passes a target string through", () => {
    expect(coerceWorkareaTarget("run://id/run-123")).toEqual({
      type: "run",
      identity: "id/run-123",
    });
    expect(coerceWorkareaTarget("pipeline://name/Churn")).toEqual({
      type: "pipeline",
      identity: "name/Churn",
    });
  });

  it("reads a run url written against another environment's origin", () => {
    expect(
      coerceWorkareaTarget("https://somewhere-else.example/runs/run-123"),
    ).toEqual({ type: "run", identity: "id/run-123" });
  });

  it("reads a run url from either run view, and from a bare path", () => {
    expect(coerceWorkareaTarget("https://host/runs-v2/run-9")).toEqual({
      type: "run",
      identity: "id/run-9",
    });
    expect(coerceWorkareaTarget("/runs/run-9")).toEqual({
      type: "run",
      identity: "id/run-9",
    });
  });

  it("ignores a query and a subgraph segment after the run id", () => {
    expect(
      coerceWorkareaTarget("https://host/runs/run-9/exec-2?tab=logs"),
    ).toEqual({ type: "run", identity: "id/run-9" });
  });

  it("rejects a url that names no run", () => {
    expect(() => coerceWorkareaTarget("https://host/pipelines/abc")).toThrow(
      /Unsupported workarea target type/,
    );
    expect(() => coerceWorkareaTarget("not a target")).toThrow(
      /Malformed workarea target/,
    );
  });
});
