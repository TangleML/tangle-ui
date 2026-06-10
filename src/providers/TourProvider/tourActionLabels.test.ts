import { describe, expect, it } from "vitest";

import { tourActionLabel } from "./tourActionLabels";

describe("tourActionLabel", () => {
  it("labels assign-secret-argument with the target argument name", () => {
    expect(
      tourActionLabel({
        interaction: "assign-secret-argument",
        targetArgumentName: "token",
      }),
    ).toBe("Assign a secret to the **token** argument");
  });

  it("falls back when assign-secret-argument has no target", () => {
    expect(tourActionLabel({ interaction: "assign-secret-argument" })).toBe(
      "Assign a secret to the argument",
    );
  });

  it("labels assign-secret-submit with the target input name", () => {
    expect(
      tourActionLabel({
        interaction: "assign-secret-submit",
        targetArgumentName: "API_KEY",
      }),
    ).toBe("Bind a secret to **API_KEY** at submit");
  });

  it("falls back when assign-secret-submit has no target", () => {
    expect(tourActionLabel({ interaction: "assign-secret-submit" })).toBe(
      "Bind a secret at submit time",
    );
  });

  it("labels open-secret-dialog", () => {
    expect(tourActionLabel({ interaction: "open-secret-dialog" })).toBe(
      "Open the secret picker from the ⚡ menu",
    );
  });

  it("labels open-settings-panel", () => {
    expect(tourActionLabel({ interaction: "open-settings-panel" })).toBe(
      "Open Settings to manage your secrets",
    );
  });

  it("labels open-submit-dialog", () => {
    expect(tourActionLabel({ interaction: "open-submit-dialog" })).toBe(
      "Open the run arguments dialog",
    );
  });

  it("uses the generic label for unknown interactions", () => {
    expect(tourActionLabel({ interaction: "not-a-real-interaction" })).toBe(
      "Complete the highlighted action to continue",
    );
  });
});
