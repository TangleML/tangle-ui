import { describe, expect, it } from "vitest";

import { readSelectedComponentDigest } from "./DashboardComponentsView";

describe("readSelectedComponentDigest", () => {
  it("returns the digest from a search record with a string `component`", () => {
    expect(readSelectedComponentDigest({ component: "abc123" })).toBe("abc123");
  });

  it("returns undefined when the `component` key is missing", () => {
    expect(readSelectedComponentDigest({})).toBeUndefined();
    expect(readSelectedComponentDigest({ other: "value" })).toBeUndefined();
  });

  it("returns undefined when `component` is present but not a string", () => {
    expect(readSelectedComponentDigest({ component: 42 })).toBeUndefined();
    expect(readSelectedComponentDigest({ component: null })).toBeUndefined();
    expect(readSelectedComponentDigest({ component: ["abc"] })).toBeUndefined();
  });

  it("returns undefined for non-record inputs", () => {
    expect(readSelectedComponentDigest(undefined)).toBeUndefined();
    expect(readSelectedComponentDigest(null)).toBeUndefined();
    expect(readSelectedComponentDigest("abc")).toBeUndefined();
    expect(readSelectedComponentDigest(["abc"])).toBeUndefined();
  });
});
