import { describe, expect, it } from "vitest";

import { runStatusFlair } from "./RunListItem";

describe("runStatusFlair", () => {
  it("is green while running or after succeeding, red after failing, and grey otherwise", () => {
    expect(runStatusFlair("RUNNING")).toMatchObject({
      tone: "success",
      pulse: true,
    });
    expect(runStatusFlair("SUCCEEDED")).toMatchObject({ tone: "success" });
    expect(runStatusFlair("FAILED")).toMatchObject({ tone: "critical" });
    expect(runStatusFlair("CANCELLED")).toEqual({
      kind: "dot",
      label: "Cancelled",
    });
    expect(runStatusFlair("SKIPPED")?.tone).toBeUndefined();
    expect(runStatusFlair(undefined)).toBeUndefined();
  });
});
