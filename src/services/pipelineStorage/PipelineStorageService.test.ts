import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPipelineDocument } from "@/services/pipelineSpecService";
import { componentSpecFromYaml } from "@/utils/yaml";

import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import * as registry from "./pipelineRegistry";
import { PipelineStorageService } from "./PipelineStorageService";

vi.mock("@/services/pipelineSpecService", () => ({
  getPipelineDocument: vi.fn(),
}));
vi.mock("./createDriver", () => ({ createDriver: () => ({}) }));
vi.mock("./pipelineRegistry");

const ref = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "pipeline-1",
} as const;
const spec = { name: "Example", implementation: { graph: { tasks: {} } } };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(getPipelineDocument).mockResolvedValue({
    id: ref.pipelineId,
    file_path: "example.yaml",
    pipeline_name: spec.name,
    root_pipeline_task: { componentRef: { spec } },
  });
});

describe("PipelineStorageService editor resolution", () => {
  it("reads remote files through their driver without local registration or mutations", async () => {
    const file = await new PipelineStorageService().resolvePipeline(ref);
    expect(getPipelineDocument).toHaveBeenCalledExactlyOnceWith(
      ref.pipelineId,
      ref.backendUrl,
    );
    expect(componentSpecFromYaml(await file.read())).toEqual(spec);
    expect(file.id).toBe(ref.pipelineId);
    expect(file.remote).toEqual({
      backendUrl: ref.backendUrl,
      pipelineId: ref.pipelineId,
    });
    expect(file.folder.canMoveFilesOut).toBe(false);
    await expect(file.write("name: Edited")).rejects.toThrow("read-only");
    await expect(file.rename("Edited")).rejects.toThrow("read-only");
    await expect(file.deleteFile()).rejects.toThrow("read-only");
    expect(file.storageKey).toBe("Example");
    expect(registry.addEntry).not.toHaveBeenCalled();
    expect(registry.findByStorageKey).not.toHaveBeenCalled();
  });

  it("propagates remote errors without resolving a local namesake", async () => {
    vi.mocked(getPipelineDocument).mockRejectedValue(
      new Error("Remote unavailable"),
    );
    const legacy = vi.spyOn(RootFolderDbStorageDriver.prototype, "hasKey");
    await expect(
      new PipelineStorageService().resolvePipeline(ref),
    ).rejects.toThrow("Remote unavailable");
    expect(registry.findById).not.toHaveBeenCalled();
    expect(registry.findByStorageKey).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });

  it("keeps file IDs and legacy name backfill for local pipelines", async () => {
    const storage = new PipelineStorageService();
    const file = await storage.resolvePipeline(ref);
    vi.spyOn(storage, "findPipelineById").mockResolvedValue(file);
    await expect(
      storage.resolvePipeline({ name: "Local", fileId: "local-id" }),
    ).resolves.toBe(file);
    expect(storage.findPipelineById).toHaveBeenCalledWith("local-id");
    vi.spyOn(storage, "resolvePipelineByName").mockResolvedValue(undefined);
    vi.spyOn(RootFolderDbStorageDriver.prototype, "hasKey").mockResolvedValue(
      true,
    );
    vi.spyOn(storage.rootFolder, "assignFile").mockResolvedValue(file);
    await expect(storage.resolvePipeline({ name: "Legacy" })).resolves.toBe(
      file,
    );
    expect(storage.rootFolder.assignFile).toHaveBeenCalledWith("Legacy");
  });
});
