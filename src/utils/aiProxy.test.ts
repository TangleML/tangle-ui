import { describe, expect, it } from "vitest";

import { buildTangleAiProxyBaseUrl, getAiRequestOptions } from "./aiProxy";

describe("AI proxy URLs", () => {
  it.each([
    ["http://localhost:8000", "http://localhost:8000/api/experimental/ai/v1"],
    [
      " https://example.com/prefix/// ",
      "https://example.com/prefix/api/experimental/ai/v1",
    ],
    ["", ""],
    ["   ", ""],
  ])("builds the backend API base from %s", (backend, expected) => {
    expect(buildTangleAiProxyBaseUrl(backend)).toBe(expected);
  });

  it.each([
    {
      apiKey: "custom-key",
      backendAuth: undefined,
      credentials: "omit",
      token: "custom-key",
    },
    { apiKey: "", backendAuth: undefined, credentials: "omit", token: "" },
    {
      apiKey: "unused-key",
      backendAuth: { token: "backend-token" },
      credentials: "include",
      token: "backend-token",
    },
    {
      apiKey: "unused-key",
      backendAuth: { token: "" },
      credentials: "include",
      token: "",
    },
  ])(
    "isolates credentials for $credentials with token '$token'",
    ({ apiKey, backendAuth, credentials, token }) => {
      expect(getAiRequestOptions({ apiKey, backendAuth })).toEqual({
        credentials,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
    },
  );
});
