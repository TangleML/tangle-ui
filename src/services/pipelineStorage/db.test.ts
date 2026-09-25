import "fake-indexeddb/auto";

import { Dexie } from "dexie";
import localForage from "localforage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentFileEntry } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { pipelineStorageDb } from "./db";
import { ROOT_FOLDER_ID } from "./types";

vi.mock("@/routes/router", () => ({ RUNS_BASE_PATH: "/runs" }));

const legacyPipelines = localForage.createInstance({
  name: "components",
  storeName: `file_store_${USER_PIPELINES_LIST_NAME}`,
});
const legacySettings = localForage.createInstance({
  name: "components",
  storeName: "component_store_settings",
});

beforeEach(async () => {
  await pipelineStorageDb.delete();
  await legacyPipelines.clear();
  await legacySettings.clear();
});

afterEach(async () => {
  pipelineStorageDb.close();
  await Dexie.delete(pipelineStorageDb.name);
  await legacyPipelines.clear();
  await legacySettings.clear();
});

describe("pipeline registry initialization", () => {
  it("opens an empty registry after reading existing legacy pipelines", async () => {
    const name = "Existing local pipeline";
    const text = `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`;
    const pipeline: ComponentFileEntry = {
      name,
      creationTime: new Date(),
      modificationTime: new Date(),
      data: new TextEncoder().encode(text).buffer,
      componentRef: {
        digest: "existing-pipeline",
        text,
        spec: { name, implementation: { graph: { tasks: {} } } },
      },
    };
    await legacySettings.setItem(
      `component_list_format_version_${USER_PIPELINES_LIST_NAME}`,
      4,
    );
    await legacyPipelines.setItem(name, pipeline);

    await pipelineStorageDb.open();

    expect(await pipelineStorageDb.pipeline_registry.toArray()).toEqual([
      {
        id: expect.any(String),
        storageKey: name,
        folderId: ROOT_FOLDER_ID,
      },
    ]);
  });
});
