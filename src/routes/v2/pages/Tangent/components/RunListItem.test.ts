import { describe, expect, it } from "vitest";

import { runStatusFlair } from "./RunListItem";

describe("runStatusFlair", () => {
  it("is blue and pulsing while running, green after succeeding, red after failing, and grey otherwise", () => {
    expect(runStatusFlair("RUNNING")).toMatchObject({
      tone: "info",
      pulse: true,
    });
    expect(runStatusFlair("SUCCEEDED")).toMatchObject({ tone: "success" });
    expect(runStatusFlair("FAILED")).toMatchObject({ tone: "critical" });
    expect(runStatusFlair("CANCELLED")).toEqual({
      kind: "dot",
      label: "Cancelled",
    });
    expect(runStatusFlair("SKIPPED")).toEqual({
      kind: "dot",
      label: "Skipped",
    });
    expect(runStatusFlair(undefined)).toBeUndefined();
  });
});
