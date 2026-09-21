import { beforeEach, describe, expect, it, vi } from "vitest";

import * as registry from "@/services/pipelineStorage/pipelineRegistry";
import type { ComponentFileEntry } from "@/utils/componentStore";
import * as componentStore from "@/utils/componentStore";

import {
  availablePipelineName,
  listLocalPipelineNames,
  pointerTo,
  readLocalPipeline,
  resolvePointers,
} from "./localPipelinesService";

vi.mock("@/utils/componentStore");
vi.mock("@/services/pipelineStorage/pipelineRegistry");

const store = vi.mocked(componentStore);
const rows = vi.mocked(registry);

function entry(name: string): ComponentFileEntry {
  return {
    name,
    creationTime: new Date("2026-09-01T10:00:00Z"),
    modificationTime: new Date("2026-09-09T10:00:00Z"),
    data: new ArrayBuffer(0),
    componentRef: {
      spec: { name, implementation: { graph: { tasks: {} } } },
      digest: "digest",
      text: `name: ${name}\n`,
    },
  } as unknown as ComponentFileEntry;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function held(...names: string[]) {
  store.getComponentFileNamesFromList.mockResolvedValue(names);
  store.getComponentFileFromList.mockImplementation(async (_list, name) =>
    names.includes(name) ? entry(name) : null,
  );
}

describe("readLocalPipeline", () => {
  beforeEach(() => {
    rows.findById.mockResolvedValue(undefined);
  });

  it("finds a pipeline by the name it was added under", async () => {
    held("Churn model");

    await expect(
      readLocalPipeline({ localName: "Churn model" }),
    ).resolves.toMatchObject({
      name: "Churn model",
      yaml: "name: Churn model\n",
    });
  });

  /**
   * The case that makes the id worth storing: renaming a pipeline frees its
   * name, and the next pipeline to take that name is a different pipeline.
   * Resolving by name would find it and look entirely successful.
   */
  it("follows a renamed pipeline rather than whatever took its old name", async () => {
    held("Churn model", "Churn model v2");
    rows.findById.mockResolvedValue({
      id: "id-9",
      storageKey: "Churn model v2",
      folderId: "__root__",
    });

    const found = await readLocalPipeline({
      localName: "Churn model",
      localId: "id-9",
    });

    expect(found?.name).toBe("Churn model v2");
  });

  it("falls back to the name when the id no longer resolves", async () => {
    held("Churn model");
    rows.findById.mockResolvedValue(undefined);

    const found = await readLocalPipeline({
      localName: "Churn model",
      localId: "id-9",
    });

    expect(found?.name).toBe("Churn model");
  });

  /** A rename through the older editor leaves the registry row behind. */
  it("falls back to the name when the id resolves to a pipeline that is gone", async () => {
    held("Churn model");
    rows.findById.mockResolvedValue({
      id: "id-9",
      storageKey: "Churn model (moved away)",
      folderId: "__root__",
    });

    const found = await readLocalPipeline({
      localName: "Churn model",
      localId: "id-9",
    });

    expect(found?.name).toBe("Churn model");
  });

  it("resolves a pipeline that was never entered in the registry", async () => {
    held("Churn model");
    rows.findById.mockResolvedValue(undefined);

    await expect(
      readLocalPipeline({ localName: "Churn model" }),
    ).resolves.toBeDefined();
    expect(rows.findById).not.toHaveBeenCalled();
  });

  it("reports nothing rather than throwing when the pipeline is gone", async () => {
    held();

    await expect(
      readLocalPipeline({ localName: "Churn model", localId: "id-9" }),
    ).resolves.toBeUndefined();
  });

  it("carries the spec through, so nothing needs to parse the yaml again", async () => {
    held("Churn model");

    const found = await readLocalPipeline({ localName: "Churn model" });

    expect(found?.spec).toMatchObject({ name: "Churn model" });
  });
});

describe("resolvePointers", () => {
  beforeEach(() => {
    rows.findById.mockResolvedValue(undefined);
  });

  it("says which pointers name a pipeline this browser holds", async () => {
    held("Churn model");

    await expect(
      resolvePointers([{ localName: "Churn model" }, { localName: "Gone" }]),
    ).resolves.toEqual({ "Churn model|": "Churn model", "Gone|": null });
  });

  /** Deserializing every pipeline to answer a yes/no per row is the cost to avoid. */
  it("reads no pipeline content to answer", async () => {
    held("Churn model");

    await resolvePointers([{ localName: "Churn model" }]);

    expect(store.getComponentFileFromList).not.toHaveBeenCalled();
    expect(store.getAllComponentFilesFromList).not.toHaveBeenCalled();
  });

  it("reads the stored names once however many pointers it is given", async () => {
    held("a", "b", "c");

    await resolvePointers([
      { localName: "a" },
      { localName: "b" },
      { localName: "c" },
    ]);

    expect(store.getComponentFileNamesFromList).toHaveBeenCalledTimes(1);
  });
});

describe("listLocalPipelineNames", () => {
  it("orders the names the way someone reading a list expects", async () => {
    held("zebra", "Apple", "mango");

    await expect(listLocalPipelineNames()).resolves.toEqual([
      "Apple",
      "mango",
      "zebra",
    ]);
  });

  it("never asks for the pipelines themselves", async () => {
    held("a");

    await listLocalPipelineNames();

    expect(store.getAllComponentFilesFromList).not.toHaveBeenCalled();
  });
});

describe("pointerTo", () => {
  it("records the id when the pipeline already has one", async () => {
    rows.findByStorageKey.mockResolvedValue({
      id: "id-9",
      storageKey: "Churn model",
      folderId: "__root__",
    });

    await expect(pointerTo("Churn model")).resolves.toEqual({
      localName: "Churn model",
      localId: "id-9",
    });
  });

  /**
   * Minting one would enter the pipeline into the registry the newer editor
   * lists folders from, changing another page as a side effect of this one.
   */
  it("does not create an id for a pipeline that has none", async () => {
    rows.findByStorageKey.mockResolvedValue(undefined);

    await expect(pointerTo("Churn model")).resolves.toEqual({
      localName: "Churn model",
    });
    expect(rows.addEntry).not.toHaveBeenCalled();
  });
});

describe("availablePipelineName", () => {
  it("keeps the name it was given when nothing holds it", async () => {
    held("Fraud model");

    await expect(availablePipelineName("Churn model")).resolves.toBe(
      "Churn model",
    );
  });

  it("numbers the name when something already holds it", async () => {
    held("Churn model");

    await expect(availablePipelineName("Churn model")).resolves.toBe(
      "Churn model 2",
    );
  });

  it("keeps counting past a number that is also taken", async () => {
    held("Churn model", "Churn model 2", "Churn model 3");

    await expect(availablePipelineName("Churn model")).resolves.toBe(
      "Churn model 4",
    );
  });

  /**
   * The name is recorded in a project's `extra_data`, which the resources API
   * caps, so a project titled with an essay cannot be passed on whole.
   */
  it("shortens a name too long to record", async () => {
    held();

    const name = await availablePipelineName("x".repeat(400));

    expect(name).toHaveLength(120);
  });

  /**
   * The list is the keyspace the driver writes into; the registry is only a
   * partial view of it, so a name free there can still be occupied.
   */
  it("asks the stored pipelines, not the registry", async () => {
    held("Churn model");

    await availablePipelineName("Churn model");

    expect(rows.findByStorageKey).not.toHaveBeenCalled();
  });
});
