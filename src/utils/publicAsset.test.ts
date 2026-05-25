import { describe, expect, it } from "vitest";

import { computeAssetsBase } from "./publicAsset";

describe("computeAssetsBase", () => {
  it("returns the dev server root in dev mode", () => {
    const base = computeAssetsBase(
      "http://localhost:5173/src/utils/publicAsset.ts",
      true,
    );
    expect(base).toBe("http://localhost:5173/");
    expect(new URL("example-pipelines/foo.yaml", base).href).toBe(
      "http://localhost:5173/example-pipelines/foo.yaml",
    );
  });

  it("returns the bundle base in built mode when assets live under a nested path", () => {
    const base = computeAssetsBase(
      "https://cdn.example.com/app/build-123/abc1234/assets/index-hash.js",
      false,
    );
    expect(base).toBe("https://cdn.example.com/app/build-123/abc1234/");
    expect(new URL("example-pipelines/foo.yaml", base).href).toBe(
      "https://cdn.example.com/app/build-123/abc1234/example-pipelines/foo.yaml",
    );
  });

  it("returns the same-origin base in built mode with a same-origin import.meta.url", () => {
    const base = computeAssetsBase(
      "https://app.example.com/assets/index-hash.js",
      false,
    );
    expect(base).toBe("https://app.example.com/");
    expect(new URL("example-pipelines/foo.yaml", base).href).toBe(
      "https://app.example.com/example-pipelines/foo.yaml",
    );
  });

  it("preserves filenames with spaces when resolved against the computed base", () => {
    const base = computeAssetsBase(
      "https://cdn.example.com/app/b/abc/assets/index.js",
      false,
    );
    expect(new URL("example-pipelines/Intro-Hello World.yaml", base).href).toBe(
      "https://cdn.example.com/app/b/abc/example-pipelines/Intro-Hello%20World.yaml",
    );
  });
});
