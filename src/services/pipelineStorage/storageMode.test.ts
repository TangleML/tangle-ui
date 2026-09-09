import { afterEach, describe, expect, it, vi } from "vitest";

import {
  currentStorageKind,
  isBackendStorage,
  resetStorageModeForTests,
  resolveStorageMode,
} from "./storageMode";

afterEach(() => {
  vi.unstubAllEnvs();
  resetStorageModeForTests();
});

describe("a deployment with the beta on", () => {
  it("keeps pipelines on the backend it is configured against", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");

    expect(resolveStorageMode().kind).toBe("backend");
    expect(isBackendStorage()).toBe(true);
    expect(currentStorageKind()).toBe("backend");
  });

  it("does not change store when the answer is asked for again", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "true");
    const first = resolveStorageMode();

    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "false");

    expect(resolveStorageMode()).toBe(first);
  });
});

describe("a deployment with the beta off", () => {
  it("keeps pipelines in the browser", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "false");

    expect(resolveStorageMode()).toEqual({ kind: "local" });
    expect(isBackendStorage()).toBe(false);
    expect(currentStorageKind()).toBe("local");
  });

  it("treats anything but a plain yes as off", () => {
    vi.stubEnv("VITE_PIPELINE_STORAGE_BETA", "1");

    expect(resolveStorageMode()).toEqual({ kind: "local" });
  });

  it("is off when nothing was said at all", () => {
    expect(resolveStorageMode()).toEqual({ kind: "local" });
  });
});
