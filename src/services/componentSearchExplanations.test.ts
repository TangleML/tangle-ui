import { describe, expect, it } from "vitest";

import { formatMatchedFieldsExplanation } from "./componentSearchExplanations";

describe("formatMatchedFieldsExplanation", () => {
  it("returns undefined when there are no matched fields", () => {
    expect(formatMatchedFieldsExplanation(undefined)).toBeUndefined();
    expect(formatMatchedFieldsExplanation([])).toBeUndefined();
  });

  it("formats one matched field", () => {
    expect(formatMatchedFieldsExplanation(["name"])).toBe("Matched name.");
  });

  it("formats multiple matched fields as readable copy", () => {
    expect(formatMatchedFieldsExplanation(["name", "io", "metadata"])).toBe(
      "Matched name, inputs/outputs, and metadata.",
    );
  });

  it("deduplicates matched fields", () => {
    expect(formatMatchedFieldsExplanation(["name", "name", "io"])).toBe(
      "Matched name and inputs/outputs.",
    );
  });
});
