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

describe("a deployment with the beta on", () => {
  it("uses the store the page provides", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "host", label: LABEL });
  });

  it("refuses to fall back to browser storage when the page provides none", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");

    expect(resolveStorageMode()).toEqual({ kind: "host-missing" });
    expect(isHostStorageMissing()).toBe(true);
    expect(isHostStorage()).toBe(false);
  });

  it("treats a store it cannot drive as none at all", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");
    installHost({ version: 99 });

    expect(resolveStorageMode()).toEqual({ kind: "host-missing" });
  });
});

describe("a deployment with the beta off", () => {
  it("ignores a store the page provides anyway", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "false");
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "local" });
  });

  it("is what an unset flag means", () => {
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "local" });
    expect(isHostStorageMissing()).toBe(false);
  });

  it("is what any other value means", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "1");
    installHost();

    expect(resolveStorageMode()).toEqual({ kind: "local" });
  });
});
