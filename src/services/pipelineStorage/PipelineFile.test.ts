import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { pipelineStorageDb } from "./db";
import { PipelineFolder } from "./PipelineFolder";
import type { PipelineStorageDriver } from "./types";

vi.mock("@/utils/componentStore", () => ({
  deleteComponentFileFromList: vi.fn(),
  getAllComponentFilesFromList: vi.fn(async () => new Map()),
  getComponentFileFromList: vi.fn(),
  renameComponentFileInList: vi.fn(),
  writeComponentToFileListFromText: vi.fn(),
}));

function setup() {
  const driver: PipelineStorageDriver = {
    type: "test",
    allowsMoveIn: false,
    allowsMoveOut: false,
    list: vi.fn().mockResolvedValue([
      {
        id: "stable-id",
        storageKey: "document.yaml",
        displayName: "Daily report",
      },
    ]),
    read: vi.fn().mockResolvedValue("name: Daily report"),
    write: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    hasKey: vi.fn().mockResolvedValue(true),
  };
  const folder = new PipelineFolder({
    id: "folder",
    name: "Folder",
    parentId: null,
    driver,
  });
  return { driver, folder };
}

beforeEach(async () => {
  await pipelineStorageDb.pipeline_registry.clear();
});

describe("pipeline file storage contract", () => {
  it("preserves identity through listing, paging and rename", async () => {
    const { folder, driver } = setup();
    const [file] = await folder.listPipelines();
    expect(file.id).toBe("stable-id");
    expect(file.displayName).toBe("Daily report");
    expect(file.storageKey).toBe("document.yaml");
    expect((await folder.listPipelinePage()).files[0].id).toBe(file.id);
    await file.rename("Renamed");
    expect(file.id).toBe("stable-id");
    expect(file.displayName).toBe("Renamed");
    expect(driver.rename).toHaveBeenCalledExactlyOnceWith(
      "document.yaml",
      "Renamed",
    );
    expect(await file.read()).toBe("name: Daily report");
  });

  it("reads content returned with storage metadata", async () => {
    const { folder, driver } = setup();
    vi.mocked(driver.read).mockResolvedValue({
      content: "name: Updated",
      descriptor: { storageKey: "document.yaml", id: "stable-id" },
    });
    const [file] = await folder.listPipelines();
    expect(await file.read()).toBe("name: Updated");
  });

  it("prevents changes to read-only files", async () => {
    const { folder, driver } = setup();
    vi.mocked(driver.list).mockResolvedValue([
      { storageKey: "read-only", canEdit: false },
    ]);
    const [file] = await folder.listPipelines();
    expect(file.canEdit).toBe(false);
    await expect(file.write("changed")).rejects.toThrow("read-only");
    await expect(file.rename("changed")).rejects.toThrow("read-only");
    await expect(file.deleteFile()).rejects.toThrow("read-only");
    expect(driver.write).not.toHaveBeenCalled();
    expect(driver.rename).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });
});
