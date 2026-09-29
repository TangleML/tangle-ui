import { afterEach, describe, expect, it, vi } from "vitest";

import { DEV_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";

import { resolveTangentBaseUrl } from "./tangentBaseUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  describe("without a usable value", () => {
    const unusable = [
      ["the key is missing", { other: "value" }],
      ["the value is blank", { tangentBaseUrl: "   " }],
      ["the value is not a string", { tangentBaseUrl: 123 }],
      ["the input is null", null],
      ["the input is undefined", undefined],
    ] as const;

    it.each(unusable)("falls back to localhost in dev when %s", (_, input) => {
      vi.stubEnv("DEV", true);

      expect(resolveTangentBaseUrl(input)).toBe(DEV_TANGENT_BASE_URL);
    });

    // A built app that reached for loopback would make the browser prompt for
    // local network access, so there it must resolve to no url at all.
    it.each(unusable)("resolves to no url in a build when %s", (_, input) => {
      vi.stubEnv("DEV", false);

      expect(resolveTangentBaseUrl(input)).toBeNull();
    });
  });
});
