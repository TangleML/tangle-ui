import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_TANGENT_BASE_URL } from "@/routes/v2/shared/tangent/constants";

import { TANGENT_STORAGE_KEY, useTangentSettings } from "./useTangentSettings";

describe("useTangentSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the default base URL when nothing is stored", () => {
    const { result } = renderHook(() => useTangentSettings());
    expect(result.current.baseUrl).toBe(DEFAULT_TANGENT_BASE_URL);
  });

  it("reads a stored base URL from localStorage", () => {
    window.localStorage.setItem(
      TANGENT_STORAGE_KEY,
      JSON.stringify({ baseUrl: "https://tangent.example.com" }),
    );

    const { result } = renderHook(() => useTangentSettings());
    expect(result.current.baseUrl).toBe("https://tangent.example.com");
  });

  it("update() persists a normalized base URL", () => {
    const { result } = renderHook(() => useTangentSettings());

    act(() => {
      result.current.update({ baseUrl: "https://tangent.example.com/  " });
    });

    expect(result.current.baseUrl).toBe("https://tangent.example.com");
    expect(
      JSON.parse(window.localStorage.getItem(TANGENT_STORAGE_KEY) ?? ""),
    ).toEqual({ baseUrl: "https://tangent.example.com" });
  });

  it("falls back to the default when the stored URL is blank", () => {
    window.localStorage.setItem(
      TANGENT_STORAGE_KEY,
      JSON.stringify({ baseUrl: "   " }),
    );

    const { result } = renderHook(() => useTangentSettings());
    expect(result.current.baseUrl).toBe(DEFAULT_TANGENT_BASE_URL);
  });

  it("reset() clears the stored URL and restores the default", () => {
    window.localStorage.setItem(
      TANGENT_STORAGE_KEY,
      JSON.stringify({ baseUrl: "https://tangent.example.com" }),
    );

    const { result } = renderHook(() => useTangentSettings());

    act(() => {
      result.current.reset();
    });

    expect(window.localStorage.getItem(TANGENT_STORAGE_KEY)).toBeNull();
    expect(result.current.baseUrl).toBe(DEFAULT_TANGENT_BASE_URL);
  });

  it("falls back to the default when stored JSON is malformed", () => {
    window.localStorage.setItem(TANGENT_STORAGE_KEY, "not json");

    const { result } = renderHook(() => useTangentSettings());
    expect(result.current.baseUrl).toBe(DEFAULT_TANGENT_BASE_URL);
  });
});
