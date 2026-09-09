import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { pipelineStorageDb } from "./db";
import type { PipelineFile } from "./PipelineFile";
import {
  forgetUnlistedSpecs,
  readCachedSpecs,
  writeCachedSpec,
} from "./pipelineSpecCache";

function fakeFile(options: {
  storageKey: string;
  contentVersion?: string;
  modifiedAt?: Date;
}): PipelineFile {
  return {
    storageKey: options.storageKey,
    contentVersion: options.contentVersion,
    modifiedAt: options.modifiedAt,
  } as PipelineFile;
}

const spec = (name: string): ComponentSpec => ({
  name,
  implementation: { graph: { tasks: {} } },
});

beforeEach(async () => {
  await pipelineStorageDb.pipeline_specs.clear();
});

describe("the pipeline spec cache", () => {
  it("answers a pipeline whose version has not moved", async () => {
    const file = fakeFile({ storageKey: "key-1", contentVersion: "v1" });
    await writeCachedSpec(file, spec("Churn model"));

    const cached = await readCachedSpecs([file]);

    expect(cached.get("key-1")).toEqual(spec("Churn model"));
  });

  it("refuses a pipeline the store has since rewritten", async () => {
    await writeCachedSpec(
      fakeFile({ storageKey: "key-1", contentVersion: "v1" }),
      spec("Churn model"),
    );

    const cached = await readCachedSpecs([
      fakeFile({ storageKey: "key-1", contentVersion: "v2" }),
    ]);

    expect(cached.has("key-1")).toBe(false);
  });

  it("falls back to the modification time when a store reports no version", async () => {
    const modifiedAt = new Date("2026-01-01T00:00:00.000Z");
    const file = fakeFile({ storageKey: "key-1", modifiedAt });
    await writeCachedSpec(file, spec("Churn model"));

    expect((await readCachedSpecs([file])).has("key-1")).toBe(true);

    const touched = fakeFile({
      storageKey: "key-1",
      modifiedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect((await readCachedSpecs([touched])).has("key-1")).toBe(false);
  });

  it("stores nothing for a pipeline with no version to check it against", async () => {
    const file = fakeFile({ storageKey: "key-1" });

    await writeCachedSpec(file, spec("Churn model"));

    expect(await pipelineStorageDb.pipeline_specs.count()).toBe(0);
  });

  it("drops pipelines the listing no longer reports", async () => {
    await writeCachedSpec(
      fakeFile({ storageKey: "key-1", contentVersion: "v1" }),
      spec("Churn model"),
    );
    await writeCachedSpec(
      fakeFile({ storageKey: "key-2", contentVersion: "v1" }),
      spec("Nightly refresh"),
    );

    await forgetUnlistedSpecs(new Set(["key-2"]));

    expect(
      await pipelineStorageDb.pipeline_specs.toCollection().primaryKeys(),
    ).toEqual(["key-2"]);
  });
});
