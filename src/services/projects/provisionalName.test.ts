import { describe, expect, it } from "vitest";

import {
  hasProvisionalName,
  provisionalNameExtraData,
  withoutProvisionalName,
} from "./provisionalName";

describe("provisional project names", () => {
  it("marks a name nobody chose", () => {
    expect(hasProvisionalName(provisionalNameExtraData())).toBe(true);
  });

  it("keeps whatever else the project was carrying", () => {
    expect(provisionalNameExtraData({ startingPrompt: "build it" })).toEqual({
      startingPrompt: "build it",
      provisionalName: true,
    });
  });

  it("treats an unmarked project as deliberately named", () => {
    expect(hasProvisionalName(null)).toBe(false);
    expect(hasProvisionalName(undefined)).toBe(false);
    expect(hasProvisionalName({})).toBe(false);
  });

  /** Anyone may PATCH a project, so the key may hold anything. */
  it("believes only the mark it writes", () => {
    expect(hasProvisionalName({ provisionalName: "yes" })).toBe(false);
    expect(hasProvisionalName({ provisionalName: 1 })).toBe(false);
  });

  it("drops the mark once a name is chosen", () => {
    const marked = provisionalNameExtraData({ startingPrompt: "build it" });

    expect(withoutProvisionalName(marked)).toEqual({
      startingPrompt: "build it",
    });
    expect(hasProvisionalName(withoutProvisionalName(marked))).toBe(false);
  });

  it("has nothing to drop from a project that was never marked", () => {
    expect(withoutProvisionalName(null)).toEqual({});
  });
});
