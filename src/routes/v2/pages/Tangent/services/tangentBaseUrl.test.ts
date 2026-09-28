import { describe, expect, it } from "vitest";

import { DEFAULT_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";

import { resolveTangentBaseUrl } from "./tangentBaseUrl";

describe("resolveTangentBaseUrl", () => {
  it("returns the configured base URL", () => {
    expect(
      resolveTangentBaseUrl({ tangentBaseUrl: "https://tangent.example.com" }),
    ).toBe("https://tangent.example.com");
  });

  it("normalizes trailing slashes and whitespace", () => {
    expect(
      resolveTangentBaseUrl({
        tangentBaseUrl: "  https://tangent.example.com/  ",
      }),
    ).toBe("https://tangent.example.com");
  });

  it("falls back to the default when the key is missing", () => {
    expect(resolveTangentBaseUrl({ other: "value" })).toBe(
      DEFAULT_TANGENT_BASE_URL,
    );
  });

  it("falls back to the default when the value is blank", () => {
    expect(resolveTangentBaseUrl({ tangentBaseUrl: "   " })).toBe(
      DEFAULT_TANGENT_BASE_URL,
    );
  });

  it("falls back to the default when the value is not a string", () => {
    expect(resolveTangentBaseUrl({ tangentBaseUrl: 123 })).toBe(
      DEFAULT_TANGENT_BASE_URL,
    );
  });

  it("falls back to the default for null or non-record input", () => {
    expect(resolveTangentBaseUrl(null)).toBe(DEFAULT_TANGENT_BASE_URL);
    expect(resolveTangentBaseUrl(undefined)).toBe(DEFAULT_TANGENT_BASE_URL);
  });
});
