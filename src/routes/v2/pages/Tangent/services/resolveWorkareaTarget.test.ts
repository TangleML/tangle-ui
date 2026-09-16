import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWorkareaTarget } from "./resolveWorkareaTarget";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  findById: mocks.findById,
}));

const options = {};

describe("resolveWorkareaTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a pipeline:// URI to a pipeline view", async () => {
    mocks.findById.mockResolvedValue({ storageKey: "My Pipeline" });

    const view = await resolveWorkareaTarget("pipeline://abc", options);

    expect(view).toEqual({
      kind: "pipeline",
      title: "My Pipeline",
      pipelineRef: { name: "My Pipeline", fileId: "abc" },
    });
  });

  it("falls back to the fileId when no registry entry exists", async () => {
    mocks.findById.mockResolvedValue(undefined);

    const view = await resolveWorkareaTarget("pipeline://abc", options);

    expect(view).toEqual({
      kind: "pipeline",
      title: "abc",
      pipelineRef: { name: "abc", fileId: "abc" },
    });
  });

  it("resolves an http URL to an artifact view", async () => {
    const view = await resolveWorkareaTarget(
      "https://host/artifact.txt",
      options,
    );

    expect(view).toEqual({
      kind: "artifact",
      title: "https://host/artifact.txt",
      url: "https://host/artifact.txt",
    });
  });

  it("treats an unknown target as a pipeline name", async () => {
    const view = await resolveWorkareaTarget("My Draft", options);

    expect(view).toEqual({
      kind: "pipeline",
      title: "My Draft",
      pipelineRef: { name: "My Draft" },
    });
  });

  it("prefers an explicit title over resolved metadata", async () => {
    mocks.findById.mockResolvedValue({ storageKey: "My Pipeline" });

    const view = await resolveWorkareaTarget("pipeline://abc", {
      title: "My Title",
    });

    expect(view).toEqual({
      kind: "pipeline",
      title: "My Title",
      pipelineRef: { name: "My Title", fileId: "abc" },
    });
  });

  it("trims surrounding whitespace before resolving", async () => {
    const view = await resolveWorkareaTarget("  https://host/a.txt  ", options);

    expect(view).toEqual({
      kind: "artifact",
      title: "https://host/a.txt",
      url: "https://host/a.txt",
    });
  });
});
