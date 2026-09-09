import { afterEach, describe, expect, it, vi } from "vitest";

import type { PipelineStorageHost } from "./host/contract";
import {
  isHostStorage,
  isHostStorageMissing,
  resetStorageModeForTests,
  resolveStorageMode,
} from "./storageMode";

const LABEL = "Shared storage";

function installHost(overrides: Partial<PipelineStorageHost> = {}) {
  const host: PipelineStorageHost = {
    version: 1,
    label: LABEL,
    list: async () => [],
    read: async () => {
      throw new Error("not used");
    },
    write: async () => {
      throw new Error("not used");
    },
    delete: async () => undefined,
    has: async () => false,
    ...overrides,
  };

  Object.defineProperty(window, "__TANGLE_PIPELINE_STORAGE_HOST__", {
    value: host,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  delete window.__TANGLE_PIPELINE_STORAGE_HOST__;
  vi.unstubAllEnvs();
  resetStorageModeForTests();
});

describe("a deployment that requires a host-provided store", () => {
  it("uses it when the page provides one", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE", "host");
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "host", label: LABEL });
  });

  it("refuses to fall back to browser storage when the page provides none", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE", "host");

    expect(resolveStorageMode()).toEqual({ kind: "host-missing" });
    expect(isHostStorageMissing()).toBe(true);
    expect(isHostStorage()).toBe(false);
  });

  it("treats a host it cannot drive as no host at all", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE", "host");
    installHost({ version: 99 });

    expect(resolveStorageMode()).toEqual({ kind: "host-missing" });
  });
});

describe("a deployment pinned to browser storage", () => {
  it("ignores a host the page provides anyway", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE", "local");
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "local" });
  });
});

describe("a deployment that says nothing", () => {
  it("uses a host if the page provides one", () => {
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "host", label: LABEL });
  });

  it("uses browser storage otherwise", () => {
    expect(resolveStorageMode()).toEqual({ kind: "local" });
    expect(isHostStorageMissing()).toBe(false);
  });
});
