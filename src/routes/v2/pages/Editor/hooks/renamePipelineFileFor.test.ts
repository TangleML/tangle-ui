import { describe, expect, it, vi } from "vitest";

import { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";
import { PipelineFileStore } from "@/routes/v2/pages/Editor/store/pipelineFileStore";
import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { renamePipelineFileFor } from "./renamePipelineFileFor";

function setup() {
  const autoSave = new AutoSaveStore();
  const save = vi.spyOn(autoSave, "save").mockResolvedValue();
  const pipelineFile = new PipelineFileStore();
  const file = new PipelineFile({
    ref: {
      source: "draft",
      backendUrl: "https://example.com",
      draftId: "draft",
      name: "Original",
    },
  });
  pipelineFile.init(file);
  const onRenamed = vi.fn();
  return { autoSave, pipelineFile, file, save, onRenamed };
}

describe("renamePipelineFileFor", () => {
  it("saves the model and updates the tab only after success", async () => {
    const { autoSave, pipelineFile, file, save, onRenamed } = setup();
    const pending = Promise.withResolvers<void>();
    save.mockReturnValue(pending.promise);
    const renaming = renamePipelineFileFor(
      autoSave,
      pipelineFile,
      onRenamed,
    )("Renamed");
    expect(onRenamed).not.toHaveBeenCalled();
    pending.resolve();
    await renaming;
    expect(save).toHaveBeenCalledOnce();
    expect(onRenamed).toHaveBeenCalledWith(file.id, "Renamed");
  });

  it("preserves the tab title when saving fails", async () => {
    const { autoSave, pipelineFile, save, onRenamed } = setup();
    save.mockRejectedValue(new Error("Unavailable"));
    await expect(
      renamePipelineFileFor(autoSave, pipelineFile, onRenamed)("Renamed"),
    ).rejects.toThrow("Unavailable");
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it("does not retitle another document after navigation", async () => {
    const { autoSave, pipelineFile, save, onRenamed } = setup();
    save.mockImplementation(async () => pipelineFile.dispose());
    await renamePipelineFileFor(autoSave, pipelineFile, onRenamed)("Renamed");
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it("checks cancellation before reporting a saved name", async () => {
    const { autoSave, pipelineFile, save, onRenamed } = setup();
    const controller = new AbortController();
    save.mockImplementation(async () => controller.abort());
    await expect(
      renamePipelineFileFor(autoSave, pipelineFile, onRenamed, () =>
        controller.signal.throwIfAborted(),
      )("Renamed"),
    ).rejects.toThrow();
    expect(onRenamed).not.toHaveBeenCalled();
  });
});
