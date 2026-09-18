import { describe, expect, it } from "vitest";

import { registerWorkareaKind } from "@/routes/v2/pages/Tangent/workarea/registry";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";

import { resolveWorkareaTarget } from "./resolveWorkareaTarget";

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
