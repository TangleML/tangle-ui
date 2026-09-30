import { beforeEach, describe, expect, it, vi } from "vitest";

import { copyRunToPipeline } from "./pipelineRunService";
import { importPipelineFromYaml, savePipelineText } from "./pipelineService";

const { createPipeline } = vi.hoisted(() => ({ createPipeline: vi.fn() }));

vi.mock("@/utils/remotePipelines", () => ({ REMOTE_PIPELINES_ENABLED: true }));
vi.mock(
  "@/services/pipelineStorage/PipelineStorageService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/services/pipelineStorage/PipelineStorageService")
    >()),
    getPipelineStorageService: () => ({ createPipeline }),
  }),
);
vi.mock("@/utils/componentStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/componentStore")>()),
  getComponentFileFromList: vi.fn().mockResolvedValue(null),
}));

const yaml =
  "name: Imported pipeline\nimplementation:\n  graph:\n    tasks: {}\n";

beforeEach(() => vi.clearAllMocks());

describe("remote pipeline creation", () => {
  it.each(["remote:server:123", "pending:server:123"])(
    "returns the %s route identity from import while retaining the human name",
    async (referenceId) => {
      createPipeline.mockResolvedValue({ referenceId });

      expect(await importPipelineFromYaml(yaml, true)).toEqual({
        name: "Imported pipeline",
        referenceId,
        fileId: referenceId,
        successful: true,
        overwritten: false,
      });
      expect(createPipeline).toHaveBeenCalledWith(
        "Imported pipeline",
        expect.stringContaining("tasks: {}"),
      );
    },
  );

  it("opens a copied run by its new remote identity", async () => {
    const referenceId = "remote:server:clone";
    createPipeline.mockResolvedValue({ referenceId });

    expect(
      await copyRunToPipeline(
        { name: "A run", implementation: { graph: { tasks: {} } } },
        "run-1",
      ),
    ).toEqual({
      name: "A run",
      url: "/editor-v2/clone",
    });
    expect(createPipeline).toHaveBeenCalledWith(
      "A run",
      expect.stringContaining("cloned_from_run_id: run-1"),
    );
  });

  it("propagates storage creation failures to the caller", async () => {
    createPipeline.mockRejectedValue(new Error("Storage unavailable"));

    await expect(savePipelineText("Imported pipeline", yaml)).rejects.toThrow(
      "Storage unavailable",
    );
  });
});
