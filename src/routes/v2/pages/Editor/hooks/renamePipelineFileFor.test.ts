import { afterEach, describe, expect, it, vi } from "vitest";

import type { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";

import { renamePipelineFileFor } from "./renamePipelineFileFor";

vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  availablePipelineName: vi.fn(),
}));

const rename = vi.fn().mockResolvedValue(undefined);

function store(storageKey: string | undefined): PipelineFileStore {
  return {
    activePipelineFile:
      storageKey === undefined
        ? undefined
        : { id: "file-1", storageKey, rename },
  } as unknown as PipelineFileStore;
}

describe("renamePipelineFileFor", () => {
  afterEach(() => vi.resetAllMocks());

  it("renames the file the pipeline is saved as", async () => {
    vi.mocked(availablePipelineName).mockResolvedValue("Churn model");

    const applied = await renamePipelineFileFor(store("Draft"))("Churn model");

    expect(rename).toHaveBeenCalledWith("Churn model");
    expect(applied).toBe("Churn model");
  });

  /** An agent picks a name without knowing what else this browser holds. */
  it("answers with the adjusted name when one is already taken", async () => {
    vi.mocked(availablePipelineName).mockResolvedValue("Churn model 2");

    const applied = await renamePipelineFileFor(store("Draft"))("Churn model");

    expect(rename).toHaveBeenCalledWith("Churn model 2");
    expect(applied).toBe("Churn model 2");
  });

  /** Otherwise renaming a pipeline to its own name bumps it to "… 2". */
  it("does nothing when the name is the one it already has", async () => {
    const applied = await renamePipelineFileFor(store("Churn model"))(
      "Churn model",
    );

    expect(rename).not.toHaveBeenCalled();
    expect(availablePipelineName).not.toHaveBeenCalled();
    expect(applied).toBe("Churn model");
  });

  it("leaves the caller its name when no pipeline is open", async () => {
    const applied = await renamePipelineFileFor(store(undefined))(
      "Churn model",
    );

    expect(rename).not.toHaveBeenCalled();
    expect(applied).toBe("Churn model");
  });

  /** A tab resolves its title once, when it opens, and never again. */
  it("reports the name it applied so the open tab can follow", async () => {
    vi.mocked(availablePipelineName).mockResolvedValue("Churn model 2");
    const onRenamed = vi.fn();

    await renamePipelineFileFor(store("Draft"), onRenamed)("Churn model");

    expect(onRenamed).toHaveBeenCalledWith("file-1", "Churn model 2");
  });

  it("reports nothing when there was nothing to rename", async () => {
    const onRenamed = vi.fn();

    await renamePipelineFileFor(store("Churn model"), onRenamed)("Churn model");

    expect(onRenamed).not.toHaveBeenCalled();
  });
});
