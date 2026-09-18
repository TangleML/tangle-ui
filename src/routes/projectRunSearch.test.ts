import { describe, expect, it } from "vitest";

import { readProjectIdParam } from "./projectRunSearch";

describe("readProjectIdParam", () => {
  it("reads the project a link carried", () => {
    expect(readProjectIdParam({ projectId: "035d6de5-23d6" })).toBe(
      "035d6de5-23d6",
    );
  });

  /** The router JSON-parses search params, so all-digit ids arrive as numbers. */
  it("reads a project whose id is all digits", () => {
    expect(readProjectIdParam({ projectId: 12345 })).toBe("12345");
  });

  it("finds nothing when no project was carried", () => {
    expect(readProjectIdParam({})).toBeUndefined();
    expect(readProjectIdParam({ other: "x" })).toBeUndefined();
  });

  /**
   * A run cannot be re-attributed once it exists, so a param that says nothing
   * usable must not become a project nobody can see.
   */
  it("ignores anything that is not a usable id", () => {
    expect(readProjectIdParam({ projectId: "" })).toBeUndefined();
    expect(readProjectIdParam({ projectId: "   " })).toBeUndefined();
    expect(readProjectIdParam({ projectId: ["a", "b"] })).toBeUndefined();
    expect(readProjectIdParam({ projectId: { id: "a" } })).toBeUndefined();
    expect(readProjectIdParam({ projectId: true })).toBeUndefined();
    expect(readProjectIdParam({ projectId: null })).toBeUndefined();
    expect(readProjectIdParam({ projectId: Number.NaN })).toBeUndefined();
  });

  it("survives a search it was handed nothing of", () => {
    expect(readProjectIdParam(undefined)).toBeUndefined();
    expect(readProjectIdParam(null)).toBeUndefined();
    expect(readProjectIdParam("projectId=x")).toBeUndefined();
  });
});
