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
    ).toEqual({ baseUrl: "https://tangent.example.com", localAddress: null });
  });

  it("normalizes trailing slashes and whitespace", () => {
    expect(
      resolveTangentBaseUrl({
        tangentBaseUrl: "  https://tangent.example.com/  ",
      }).baseUrl,
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

      expect(resolveTangentBaseUrl(input)).toEqual({
        baseUrl: DEV_TANGENT_BASE_URL,
        localAddress: null,
      });
    });

    // A built app that reached for loopback would make the browser prompt for
    // local network access, so there it must resolve to no url at all.
    it.each(unusable)("resolves to no url in a build when %s", (_, input) => {
      vi.stubEnv("DEV", false);

      expect(resolveTangentBaseUrl(input)).toEqual({
        baseUrl: null,
        localAddress: null,
      });
    });
  });

  // Tangent is deployed alongside Tangle, so a workspace still carrying a
  // developer's address is a misconfiguration rather than a supported setup.
  describe("a workspace pointing at the local network", () => {
    const localAddresses = [
      "http://localhost:5173",
      "http://LOCALHOST:5173",
      "http://tangent.localhost:5173",
      "http://127.0.0.1:5173",
      "http://127.2.3.4:5173",
      "http://0.0.0.0:5173",
      "http://[::1]:5173",
      "http://10.1.2.3:5173",
      "http://172.16.0.9:5173",
      "http://172.31.255.1:5173",
      "http://192.168.1.10:5173",
      "http://169.254.10.1:5173",
      "http://someones-laptop.local:5173",
    ];

    it.each(localAddresses)("is refused in a build: %s", (tangentBaseUrl) => {
      vi.stubEnv("DEV", false);

      expect(resolveTangentBaseUrl({ tangentBaseUrl })).toEqual({
        baseUrl: null,
        localAddress: tangentBaseUrl,
      });
    });

    it.each(localAddresses)("is honoured in dev: %s", (tangentBaseUrl) => {
      vi.stubEnv("DEV", true);

      expect(resolveTangentBaseUrl({ tangentBaseUrl }).baseUrl).toBe(
        tangentBaseUrl,
      );
    });
  });

  describe("addresses a build still accepts", () => {
    const routable = [
      "https://tangent.example.com",
      "https://tangent.internal.example.com",
      "http://172.32.0.1:5173",
      "http://11.0.0.1:5173",
      "http://193.168.1.10:5173",
      "https://localhost.example.com",
    ];

    it.each(routable)("is not mistaken for local: %s", (tangentBaseUrl) => {
      vi.stubEnv("DEV", false);

      expect(resolveTangentBaseUrl({ tangentBaseUrl })).toEqual({
        baseUrl: tangentBaseUrl,
        localAddress: null,
      });
    });
  });
});
