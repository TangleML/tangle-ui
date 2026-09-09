import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultEditorHref, getDefaultEditorTarget } from "./editorRoutes";

const { hostStorage } = vi.hoisted(() => ({ hostStorage: vi.fn(() => false) }));

vi.mock("@/services/pipelineStorage/storageMode", () => ({
  isHostStorage: hostStorage,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: () => true,
}));

const REF = { name: "Churn model", fileId: "ab420234-a05f" };

afterEach(() => {
  hostStorage.mockReturnValue(false);
});

describe("where a store hands out its own ids", () => {
  it("puts the id in the path and nothing else anywhere", () => {
    hostStorage.mockReturnValue(true);

    expect(getDefaultEditorTarget(REF)).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "ab420234-a05f" },
    });
    expect(getDefaultEditorHref(REF)).toBe("/editor-v2/ab420234-a05f");
  });

  it("falls back to the name for a pipeline with no id yet", () => {
    hostStorage.mockReturnValue(true);

    expect(getDefaultEditorHref({ name: "Churn model" })).toBe(
      "/editor-v2/Churn%20model",
    );
  });
});

describe("where names are the identity", () => {
  it("puts the name in the path and never mentions the id", () => {
    expect(getDefaultEditorTarget(REF)).toEqual({
      to: "/editor-v2/$pipelineName",
      params: { pipelineName: "Churn model" },
    });
    expect(getDefaultEditorHref(REF)).toBe("/editor-v2/Churn%20model");
  });
});
