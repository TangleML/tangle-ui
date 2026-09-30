import { beforeEach, describe, expect, it, vi } from "vitest";

import { copyRunToPipeline } from "./pipelineRunService";
import { importPipelineFromYaml } from "./pipelineService";
import { PipelineStorageService } from "./pipelineStorage/PipelineStorageService";

const { createPipeline } = vi.hoisted(() => ({ createPipeline: vi.fn() }));

vi.mock("@/utils/remotePipelines", () => ({ REMOTE_PIPELINES_ENABLED: true }));
vi.mock("@/utils/componentStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/componentStore")>()),
  getComponentFileFromList: vi.fn().mockResolvedValue(null),
}));

const storage = new PipelineStorageService();
vi.spyOn(storage, "remoteEnabled", "get").mockReturnValue(true);
vi.spyOn(storage, "createPipeline").mockImplementation(createPipeline);

const yaml =
  "name: Imported pipeline\nimplementation:\n  graph:\n    tasks: {}\n";

beforeEach(() => vi.clearAllMocks());

describe("remote pipeline creation", () => {
  it.each(["remote:server:123", "pending:server:123"])(
    "returns the %s route identity from import while retaining the human name",
    async (referenceId) => {
      createPipeline.mockResolvedValue({ id: "document-id", referenceId });

      expect(await importPipelineFromYaml(storage, yaml, true)).toEqual({
        name: "Imported pipeline",
        referenceId,
        fileId: "document-id",
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
    createPipeline.mockResolvedValue({ id: "clone-document-id", referenceId });

    expect(
      await copyRunToPipeline(
        storage,
        { name: "A run", implementation: { graph: { tasks: {} } } },
        "run-1",
      ),
    ).toEqual({
      name: "A run",
      ref: { name: "A run", fileId: "clone-document-id" },
      url: "/editor-v2/clone",
    });
    expect(createPipeline).toHaveBeenCalledWith(
      "A run",
      expect.stringContaining("cloned_from_run_id: run-1"),
    );
  });

  it("propagates storage creation failures to the caller", async () => {
    createPipeline.mockRejectedValue(new Error("Storage unavailable"));

    expect(await importPipelineFromYaml(storage, yaml)).toMatchObject({
      successful: false,
      errorMessage: "Storage unavailable",
    });
  });

  it("uses the caller's storage after another storage session is created", async () => {
    const otherStorage = new PipelineStorageService();
    const createOtherPipeline = vi.spyOn(otherStorage, "createPipeline");
    createPipeline.mockResolvedValue({ referenceId: "remote:first:123" });

    const result = await importPipelineFromYaml(storage, yaml);

    expect(result.referenceId).toBe("remote:first:123");
    expect(createOtherPipeline).not.toHaveBeenCalled();
  });
});
