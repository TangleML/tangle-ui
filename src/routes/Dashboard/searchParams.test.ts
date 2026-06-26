import { describe, expect, it } from "vitest";

import {
  createDashboardComponentsV2SearchParams,
  readComponentSearchQuery,
  readDisabledSourceKeys,
  readSelectedComponentDigest,
} from "./searchParams";

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

describe("readComponentSearchQuery", () => {
  it("returns the query from a string `q` param", () => {
    expect(readComponentSearchQuery({ q: "train model" })).toBe("train model");
  });

  it("returns an empty string when `q` is missing or invalid", () => {
    expect(readComponentSearchQuery({})).toBe("");
    expect(readComponentSearchQuery({ q: 42 })).toBe("");
    expect(readComponentSearchQuery(undefined)).toBe("");
  });
});

describe("readDisabledSourceKeys", () => {
  it("reads valid comma-separated source keys", () => {
    expect(
      readDisabledSourceKeys({ disabled_sources: "registered,user" }),
    ).toEqual(["registered", "user"]);
  });

  it("drops unknown source keys", () => {
    expect(
      readDisabledSourceKeys({
        disabled_sources: "registered,unknown,standard",
      }),
    ).toEqual(["registered", "standard"]);
  });

  it("returns an empty list when source keys are missing or invalid", () => {
    expect(readDisabledSourceKeys({})).toEqual([]);
    expect(readDisabledSourceKeys({ disabled_sources: 42 })).toEqual([]);
    expect(readDisabledSourceKeys(undefined)).toEqual([]);
  });
});

describe("createDashboardComponentsV2SearchParams", () => {
  it("omits empty values", () => {
    expect(
      createDashboardComponentsV2SearchParams({
        q: "  ",
        disabledSourceKeys: [],
      }),
    ).toEqual({});
  });

  it("preserves search query whitespace so URL sync does not rewrite active input", () => {
    expect(
      createDashboardComponentsV2SearchParams({
        component: "abc123",
        q: "  train model  ",
        disabledSourceKeys: ["registered", "unknown"],
      }),
    ).toEqual({
      component: "abc123",
      q: "  train model  ",
      disabled_sources: "registered",
    });
  });
});
