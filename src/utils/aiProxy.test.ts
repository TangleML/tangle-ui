import { describe, expect, it } from "vitest";

import { buildTangleAiProxyBaseUrl, isTangleAiProxyBaseUrl } from "./aiProxy";

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
    ["https://example.com/api/experimental/ai/v1/", true],
    [" https://example.com/prefix/api/experimental/ai/v1 ", true],
    ["https://api.openai.com/v1", false],
    ["https://example.com/api/experimental/ai/v1/responses", false],
    ["", false],
  ])("recognizes a backend base URL: %s", (base, expected) => {
    expect(isTangleAiProxyBaseUrl(base)).toBe(expected);
  });
});
