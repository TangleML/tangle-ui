import { describe, expect, it } from "vitest";

import { resolveWorkareaTarget } from "./resolveWorkareaTarget";

describe("resolveWorkareaTarget", () => {
  it("resolves an http URL to an artifact view titled by the URL", () => {
    expect(resolveWorkareaTarget("http://host/artifact.txt")).toEqual({
      kind: "artifact",
      title: "http://host/artifact.txt",
      url: "http://host/artifact.txt",
    });
  });

  it("resolves an https URL to an artifact view", () => {
    expect(resolveWorkareaTarget("https://host/report.html")).toEqual({
      kind: "artifact",
      title: "https://host/report.html",
      url: "https://host/report.html",
    });
  });

  it("uses the provided title when given", () => {
    expect(
      resolveWorkareaTarget("https://host/a.txt", { title: "Result" }),
    ).toEqual({
      kind: "artifact",
      title: "Result",
      url: "https://host/a.txt",
    });
  });

  it("trims surrounding whitespace before resolving", () => {
    expect(resolveWorkareaTarget("  https://host/a.txt  ")).toEqual({
      kind: "artifact",
      title: "https://host/a.txt",
      url: "https://host/a.txt",
    });
  });

  it("throws for a pipeline:// target (owned by a later PR)", () => {
    expect(() => resolveWorkareaTarget("pipeline://abc")).toThrow(
      /Unsupported workarea target/,
    );
  });

  it("throws for a run: target (owned by a later PR)", () => {
    expect(() => resolveWorkareaTarget("run:123")).toThrow(
      /Unsupported workarea target/,
    );
  });

  it("throws for a bare name", () => {
    expect(() => resolveWorkareaTarget("My Draft")).toThrow(
      /Unsupported workarea target/,
    );
  });
});
