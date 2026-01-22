import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useBetaFlagValue } from "../useBetaFlags";

vi.mock("@/betaFlags", () => ({
  ExistingBetaFlags: {
    codeViewer: {
      name: "Code Viewer",
      description: "Code Viewer",
      default: false,
    },
  },
}));

describe("useBetaFlagValue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it("should return false by default when no flag is stored", () => {
    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return stored flag value when flag exists in localStorage", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: true }));

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(true);
  });

  it("should return stored flag value when flag is explicitly set to false", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ codeViewer: false }));

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return false when betaFlags exists but specific flag is not set", () => {
    localStorage.setItem("betaFlags", JSON.stringify({ otherFlag: true }));

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should return false when localStorage contains invalid JSON", () => {
    localStorage.setItem("betaFlags", "invalid-json");

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(false);
  });

  it("should react to localStorage changes and update the returned value", async () => {
    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

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

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

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

    const { result } = renderHook(() => useBetaFlagValue("codeViewer" as any));

    expect(result.current).toBe(true);
  });
});
