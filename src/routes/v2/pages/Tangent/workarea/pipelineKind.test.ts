import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkareaIdentity } from "./types";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Editor/EmbeddedPipelineEditor", () => ({
  EmbeddedPipelineEditor: () => null,
}));

vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  findById: mocks.findById,
}));

import "./pipelineKind";

import { getWorkareaKind } from "./registry";

function resolvePipelineTitle(
  identity: WorkareaIdentity,
): string | Promise<string> {
  const kind = getWorkareaKind("pipeline");
  if (!kind) throw new Error("pipeline kind is not registered");
  return kind.resolveTitle({ type: "pipeline", identity });
}

describe("pipelineKind resolveTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the registry storageKey for an id target", async () => {
    mocks.findById.mockResolvedValue({ storageKey: "My Pipeline" });

    await expect(resolvePipelineTitle("id/abc")).resolves.toBe("My Pipeline");
    expect(mocks.findById).toHaveBeenCalledWith("abc");
  });

  it("falls back to the fileId when no registry entry exists", async () => {
    mocks.findById.mockResolvedValue(undefined);

    await expect(resolvePipelineTitle("id/abc")).resolves.toBe("abc");
  });

  it("uses the name for a name target without a registry lookup", async () => {
    await expect(resolvePipelineTitle("name/My Draft")).resolves.toBe(
      "My Draft",
    );
    expect(mocks.findById).not.toHaveBeenCalled();
  });
});
