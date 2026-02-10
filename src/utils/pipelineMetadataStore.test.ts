import { beforeEach, describe, expect, it } from "vitest";

import {
  getAllPipelineMetadata,
  getPipelineMetadata,
  setPipelineTags,
  togglePipelinePinned,
} from "@/utils/pipelineMetadataStore";

const STORAGE_KEY = "dashboard/pipeline-metadata";

describe("pipelineMetadataStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty map when storage is missing", () => {
    expect(getAllPipelineMetadata()).toEqual({});
  });

  it("sets and gets pipeline tags", () => {
    setPipelineTags("pipeline-a", ["team-a", "urgent", "team-a", "  "]);

    expect(getPipelineMetadata("pipeline-a")).toEqual({
      tags: ["team-a", "urgent"],
      pinned: false,
    });
  });

  it("toggles pinned while preserving existing tags", () => {
    setPipelineTags("pipeline-a", ["alpha"]);
    togglePipelinePinned("pipeline-a");

    expect(getPipelineMetadata("pipeline-a")).toEqual({
      tags: ["alpha"],
      pinned: true,
    });

    togglePipelinePinned("pipeline-a");

    expect(getPipelineMetadata("pipeline-a")).toEqual({
      tags: ["alpha"],
      pinned: false,
    });
  });

  it("ignores invalid persisted values", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ok: { tags: ["one"], pinned: true },
        bad1: { tags: "one", pinned: true },
        bad2: { tags: ["one"], pinned: "yes" },
      }),
    );

    expect(getAllPipelineMetadata()).toEqual({
      ok: { tags: ["one"], pinned: true },
    });
  });
});
