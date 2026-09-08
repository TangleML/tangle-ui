import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { createDriver } from "../createDriver";
import type {
  HostErrorCode,
  HostPipeline,
  HostPipelineSummary,
  PipelineStorageHost,
} from "../host/contract";
import { resetStorageModeForTests } from "../storageMode";
import type { PipelineStorageDriver } from "../types";
import { HostStorageDriver, HostStorageError } from "./HostStorageDriver";

const LABEL = "Shared storage";

interface FakeHost extends PipelineStorageHost {
  readonly writtenSpecs: unknown[];
  readonly readCalls: string[];
}

function createFakeHost(seed: Record<string, HostPipeline> = {}): FakeHost {
  const store = new Map(Object.entries(seed));
  const writtenSpecs: unknown[] = [];
  const readCalls: string[] = [];
  let revision = 0;

  return {
    version: 1,
    label: LABEL,
    writtenSpecs,
    readCalls,
    async list(): Promise<HostPipelineSummary[]> {
      return [...store.values()].map(({ spec: _spec, ...summary }) => summary);
    },
    async read(key: string): Promise<HostPipeline> {
      readCalls.push(key);
      const pipeline = store.get(key);
      if (!pipeline) throw { code: "not_found" };
      return pipeline;
    },
    async write(key: string, spec: unknown): Promise<HostPipelineSummary> {
      writtenSpecs.push(spec);
      revision += 1;
      const existing = store.get(key);
      const pipeline: HostPipeline = {
        key,
        externalId: existing?.externalId ?? `external-${store.size + 1}`,
        displayName: readSpecName(spec),
        contentVersion: `v${revision}`,
        spec,
      };
      store.set(key, pipeline);
      const { spec: _spec, ...summary } = pipeline;
      return summary;
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async has(key: string): Promise<boolean> {
      return store.has(key);
    },
  };
}

function readSpecName(spec: unknown): string | null {
  if (typeof spec !== "object" || spec === null) return null;
  const name: unknown = Reflect.get(spec, "name");
  return typeof name === "string" ? name : null;
}

function hostPipeline(
  key: string,
  overrides: Partial<HostPipeline> = {},
): HostPipeline {
  return {
    key,
    externalId: `external-${key}`,
    displayName: "Churn model",
    contentVersion: "v1",
    spec: { name: "Churn model", implementation: { graph: { tasks: {} } } },
    ...overrides,
  };
}

function rejectingHost(rejection: unknown): PipelineStorageHost {
  const reject = () => Promise.reject(rejection);
  return {
    version: 1,
    label: LABEL,
    list: reject,
    read: reject,
    write: reject,
    delete: reject,
    has: reject,
  };
}

describe("HostStorageDriver.list", () => {
  it("maps summaries to descriptors without reading any pipeline", async () => {
    const host = createFakeHost({
      "key-1": hostPipeline("key-1", {
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-02-01T00:00:00.000Z",
      }),
    });

    const descriptors = await new HostStorageDriver(host).list();

    expect(descriptors).toEqual([
      {
        storageKey: "key-1",
        externalId: "external-key-1",
        displayName: "Churn model",
        contentVersion: "v1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        modifiedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]);
    expect(host.readCalls).toEqual([]);
  });

  it("falls back to a placeholder display name when the host has none", async () => {
    const host = createFakeHost({
      "key-1": hostPipeline("key-1", { displayName: null }),
    });

    const [descriptor] = await new HostStorageDriver(host).list();

    expect(descriptor.displayName).toBe("Untitled pipeline");
  });

  it("omits timestamps the host reports unparseably", async () => {
    const host = createFakeHost({
      "key-1": hostPipeline("key-1", { createdAt: "not-a-date" }),
    });

    const [descriptor] = await new HostStorageDriver(host).list();

    expect(descriptor.createdAt).toBeUndefined();
  });
});

describe("HostStorageDriver.write", () => {
  it("projects the document before handing it to the host", async () => {
    const host = createFakeHost();
    const yamlText = componentSpecToYaml({
      name: "Churn model",
      inputs: [{ name: "epochs", default: "10", value: "42" }],
      implementation: {
        graph: {
          tasks: {
            train: {
              componentRef: {
                name: "Train",
                favorited: true,
                owned: true,
                spec: {
                  name: "Train",
                  implementation: { container: { image: "python:3.11" } },
                },
              },
            },
          },
        },
      },
    });

    await new HostStorageDriver(host).write("key-1", yamlText);

    const written = JSON.stringify(host.writtenSpecs[0]);
    expect(written).not.toContain("favorited");
    expect(written).not.toContain("owned");
    expect(written).not.toContain('"value"');
    expect(written).toContain("epochs");
  });

  it("returns the descriptor the host reports for the write", async () => {
    const host = createFakeHost();
    const yamlText = componentSpecToYaml({
      name: "Churn model",
      implementation: { graph: { tasks: {} } },
    });

    const descriptor = await new HostStorageDriver(host).write(
      "key-1",
      yamlText,
    );

    expect(descriptor).toMatchObject({
      storageKey: "key-1",
      displayName: "Churn model",
      contentVersion: "v1",
    });
    expect(descriptor.externalId).toBeDefined();
  });

  it("reports a fresh contentVersion on every write", async () => {
    const driver = new HostStorageDriver(createFakeHost());
    const yamlText = componentSpecToYaml({
      name: "Churn model",
      implementation: { graph: { tasks: {} } },
    });

    const first = await driver.write("key-1", yamlText);
    const second = await driver.write("key-1", yamlText);

    expect(second.contentVersion).not.toBe(first.contentVersion);
  });
});

describe("HostStorageDriver round trip", () => {
  it("returns YAML for a pipeline it previously saved", async () => {
    const spec: ComponentSpec = {
      name: "Churn model",
      description: "Predicts churn",
      inputs: [{ name: "epochs", type: "Integer", default: "10" }],
      implementation: {
        graph: {
          tasks: {
            train: {
              componentRef: {
                name: "Train",
                spec: {
                  name: "Train",
                  implementation: { container: { image: "python:3.11" } },
                },
              },
              annotations: { "editor.position": '{"x":10,"y":20}' },
            },
          },
        },
      },
    };
    const driver = new HostStorageDriver(createFakeHost());

    await driver.write("key-1", componentSpecToYaml(spec));
    const yamlText = await driver.read("key-1");

    expect(componentSpecFromYaml(yamlText)).toEqual(spec);
  });

  it("rejects a pipeline the host returns in an unreadable shape", async () => {
    const host = createFakeHost({
      "key-1": hostPipeline("key-1", { spec: { nope: true } }),
    });

    await expect(new HostStorageDriver(host).read("key-1")).rejects.toThrow(
      HostStorageError,
    );
  });
});

describe("HostStorageDriver.rename", () => {
  it("is not offered, because a key carries no name for the host", () => {
    const driver: PipelineStorageDriver = new HostStorageDriver(
      createFakeHost(),
    );

    expect(driver.rename).toBeUndefined();
  });
});

describe("HostStorageDriver.delete and hasKey", () => {
  it("removes the pipeline from the host", async () => {
    const host = createFakeHost({ "key-1": hostPipeline("key-1") });
    const driver = new HostStorageDriver(host);

    expect(await driver.hasKey("key-1")).toBe(true);
    await driver.delete("key-1");

    expect(await driver.hasKey("key-1")).toBe(false);
  });
});

describe("HostStorageDriver error mapping", () => {
  const cases: [HostErrorCode, RegExp][] = [
    ["unauthenticated", /session has expired/],
    ["not_found", /no longer exists/],
    ["rate_limited", /is busy/],
    ["conflict", /changed in/],
    ["unavailable", /could not be reached/],
  ];

  it.each(cases)(
    "maps the %s code to its own message",
    async (code, matcher) => {
      const driver = new HostStorageDriver(rejectingHost({ code }));

      await expect(driver.list()).rejects.toMatchObject({
        code,
        message: expect.stringMatching(matcher),
      });
    },
  );

  it.each([
    ["an unrecognised code", { code: "teapot" }],
    ["no code at all", new Error("boom")],
    ["a non-object rejection", "boom"],
  ])("degrades %s to unavailable", async (_case, rejection) => {
    const driver = new HostStorageDriver(rejectingHost(rejection));

    await expect(driver.read("key-1")).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("names the host label from the contract rather than a hardcoded name", async () => {
    const host = {
      ...rejectingHost({ code: "unavailable" }),
      label: "Team drive",
    };

    await expect(new HostStorageDriver(host).list()).rejects.toThrow(
      /Team drive/,
    );
  });

  it("keeps the original rejection as the error cause", async () => {
    const rejection = { code: "conflict", detail: "revision mismatch" };
    const driver = new HostStorageDriver(rejectingHost(rejection));

    const error = await driver.list().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(HostStorageError);
    expect((error as HostStorageError).cause).toBe(rejection);
  });

  it("maps every failing operation, not just reads", async () => {
    const driver = new HostStorageDriver(rejectingHost({ code: "conflict" }));
    const yamlText = componentSpecToYaml({
      name: "Churn model",
      implementation: { graph: { tasks: {} } },
    });

    await expect(driver.write("key-1", yamlText)).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(driver.delete("key-1")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(driver.hasKey("key-1")).rejects.toMatchObject({
      code: "conflict",
    });
  });
});

describe("createDriver without a detected host", () => {
  beforeEach(() => {
    resetStorageModeForTests();
  });

  afterEach(() => {
    delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
    resetStorageModeForTests();
  });

  it.each([
    ["no host global", undefined],
    ["a host with a non-function member", { ...createFakeHost(), write: null }],
    [
      "a host declaring an unsupported version",
      { ...createFakeHost(), version: 99 },
    ],
  ])("refuses to build a host driver with %s", (_case, host) => {
    if (host) {
      Object.defineProperty(window, "__TANGLE_PIPELINE_STORAGE_HOST__", {
        value: host,
        configurable: true,
        writable: true,
      });
    }

    expect(() => createDriver({ driverType: "host" })).toThrow();
  });

  it("leaves the local drivers untouched", () => {
    expect(() => createDriver({ driverType: "root-indexdb" })).not.toThrow();
    expect(() =>
      createDriver({ driverType: "folder-indexdb", folderId: "folder-1" }),
    ).not.toThrow();
  });
});

describe("HostStorageDriver capabilities", () => {
  it("owns its listing and accepts no moves", () => {
    const driver = new HostStorageDriver(createFakeHost());

    expect(driver.listingIsAuthoritative).toBe(true);
    expect(driver.allowsMoveIn).toBe(false);
    expect(driver.allowsMoveOut).toBe(false);
  });

  it("does not touch the host until an operation is called", () => {
    const host = createFakeHost();
    const list = vi.spyOn(host, "list");

    new HostStorageDriver(host);

    expect(list).not.toHaveBeenCalled();
  });
});
