import { describe, expect, test } from "vitest";

import { validatePAT } from "./validatePAT";

describe("validatePAT", () => {
  test("accepts an empty token", () => {
    expect(validatePAT("")).toBeNull();
  });

  test("accepts a whitespace-only token", () => {
    expect(validatePAT("   ")).toBeNull();
  });

  test("accepts a classic token starting with ghp_", () => {
    expect(validatePAT("ghp_abc123")).toBeNull();
  });

  test("accepts a fine-grained token starting with github_pat_", () => {
    expect(validatePAT("github_pat_abc123")).toBeNull();
  });

  test("accepts a token with surrounding whitespace", () => {
    expect(validatePAT(" ghp_abc")).toBeNull();
  });

  test("rejects a token with an unknown prefix", () => {
    expect(validatePAT("abc123")).toEqual([
      "Invalid Personal Access Token. Must start with ghp_ or github_pat_",
    ]);
  });
});
