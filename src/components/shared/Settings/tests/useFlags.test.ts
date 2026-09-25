import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled, useFlagValue } from "../useFlags";

vi.mock("@/flags", () => ({
  ExistingFlags: {
    codeViewer: {
      name: "Code Viewer",
      description: "Code Viewer",
      default: false,
      category: "beta",
    },
    parentFeature: {
      name: "Parent Feature",
      description: "Parent Feature",
      default: false,
      category: "beta",
    },
    dependentFeature: {
      name: "Dependent Feature",
      description: "Dependent Feature",
      default: false,
      category: "beta",
      dependsOn: "parentFeature",
    },
    grandchildFeature: {
      name: "Grandchild Feature",
      description: "Grandchild Feature",
      default: false,
      category: "beta",
      dependsOn: "dependentFeature",
    },
    orphanFeature: {
      name: "Orphan Feature",
      description: "Orphan Feature",
      default: false,
      category: "beta",
      dependsOn: "noSuchFlag",
    },
  },
}));

describe("useFlagValue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it("should return false by default when no flag is stored", () => {
    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return stored flag value when flag exists in localStorage", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: true }));

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(true);
  });

  it("should return stored flag value when flag is explicitly set to false", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: false }));

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return false when betaFlags exists but specific flag is not set", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ otherFlag: true }));

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return false when localStorage contains invalid JSON", () => {
    localStorage.setItem("betaFlags", "invalid-json");

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should react to localStorage changes and update the returned value", async () => {
    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);

    await act(async () => {
      localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: true }));
      // Manually dispatch storage event to simulate the behavior from getStorage
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "betaFlags",
          newValue: JSON.stringify({ codeViewer: true }),
        }),
      );
    });

    // Should now return true
    expect(result.current).toBe(true);
  });

  it("should react to localStorage changes and update from true to false", async () => {
    // Start with flag set to true
    localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: true }));

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(true);

    await act(async () => {
      localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: false }));
      // Manually dispatch storage event
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "betaFlags",
          newValue: JSON.stringify({ codeViewer: false }),
        }),
      );
    });

    // Should now return false
    expect(result.current).toBe(false);
  });

  it("should handle multiple flags in localStorage correctly", () => {
    localStorage.setItem(
      "betaFlags",
      JSON.stringify({
        codeViewer: true,
        otherFlag: false,
        thirdFlag: false,
      }),
    );

    const { result } = renderHook(() => useFlagValue("codeViewer" as any));

    expect(result.current).toBe(true);
  });
});

describe("flag dependencies", () => {
  const store = (flags: Record<string, boolean>) =>
    localStorage.setItem("betaFlags", JSON.stringify(flags));

  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it("reads a dependent flag as on when its dependency is on", () => {
    store({ parentFeature: true, dependentFeature: true });

    const { result } = renderHook(() =>
      useFlagValue("dependentFeature" as any),
    );

    expect(result.current).toBe(true);
  });

  it("reads a dependent flag as off when its dependency is off", () => {
    store({ parentFeature: false, dependentFeature: true });

    const { result } = renderHook(() =>
      useFlagValue("dependentFeature" as any),
    );

    expect(result.current).toBe(false);
  });

  /**
   * The point of resolving at read time rather than rewriting storage: someone
   * who turns a dependency off and on again gets back what they had.
   */
  it("restores a dependent flag when its dependency comes back", () => {
    store({ parentFeature: false, dependentFeature: true });
    expect(isFlagEnabled("dependentFeature" as any)).toBe(false);

    store({ parentFeature: true, dependentFeature: true });
    expect(isFlagEnabled("dependentFeature" as any)).toBe(true);
  });

  it("does not turn a dependent flag on just because its dependency is", () => {
    store({ parentFeature: true, dependentFeature: false });

    expect(isFlagEnabled("dependentFeature" as any)).toBe(false);
  });

  it("resolves the whole chain, not just the nearest link", () => {
    store({
      parentFeature: false,
      dependentFeature: true,
      grandchildFeature: true,
    });

    expect(isFlagEnabled("grandchildFeature" as any)).toBe(false);
  });

  it("fails closed when the dependency names a flag that does not exist", () => {
    store({ orphanFeature: true });

    expect(isFlagEnabled("orphanFeature" as any)).toBe(false);
  });

  it("leaves a flag without dependencies alone", () => {
    store({ parentFeature: true });

    expect(isFlagEnabled("parentFeature" as any)).toBe(true);
  });
});
