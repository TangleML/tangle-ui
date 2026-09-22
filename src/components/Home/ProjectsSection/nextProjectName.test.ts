import { describe, expect, it } from "vitest";

import { nextProjectName } from "./nextProjectName";

describe("nextProjectName", () => {
  it("starts at one", () => {
    expect(nextProjectName([])).toBe("Project 1");
  });

  it("counts on from the ones already there", () => {
    expect(nextProjectName(["Project 1", "Project 2"])).toBe("Project 3");
  });

  /** Projects get deleted, so the numbers are not a sequence to continue. */
  it("takes a number freed up in the middle", () => {
    expect(nextProjectName(["Project 1", "Project 3"])).toBe("Project 2");
  });

  it("pays no attention to projects named something else", () => {
    expect(nextProjectName(["Churn model", "Q3 forecast"])).toBe("Project 1");
  });
});
