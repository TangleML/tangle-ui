import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useComponentSearchSettings } from "./useComponentSearchSettings";

const STORAGE_KEY = "tangle.componentSearchV2.config";

describe("useComponentSearchSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    const { result } = renderHook(() => useComponentSearchSettings());

    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "",
    });
    expect(result.current.isConfigured).toBe(false);
  });

  it("reads stored values from localStorage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());

    expect(result.current.config).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
    expect(result.current.isConfigured).toBe(true);
  });

  it("isConfigured only requires apiBase", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());
    expect(result.current.isConfigured).toBe(true);
  });

  it("update() writes to localStorage and merges partial values", () => {
    const { result } = renderHook(() => useComponentSearchSettings());

    act(() => {
      result.current.update({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
    });

    expect(result.current.config.model).toBe("gpt-4o-mini");
    expect(result.current.isConfigured).toBe(true);

    act(() => {
      result.current.update({ model: "claude-3-5-haiku" });
    });

    const storedConfig = window.localStorage.getItem(STORAGE_KEY);
    expect(storedConfig).not.toBeNull();
    const stored = JSON.parse(storedConfig ?? "");
    expect(stored).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "claude-3-5-haiku",
    });
  });

  it("clear() removes the stored config", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());

    act(() => {
      result.current.clear();
    });

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.isConfigured).toBe(false);
  });

  it("migrates legacy `thinkingModel` into `model` when model is unset", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        thinkingModel: "gpt-5-mini",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());
    expect(result.current.config.model).toBe("gpt-5-mini");
  });

  it("prefers `model` over legacy `thinkingModel` when both exist", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        thinkingModel: "gpt-5-mini",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());
    expect(result.current.config.model).toBe("gpt-4o-mini");
  });

  it("keeps an intentionally blank `model` over legacy `thinkingModel`", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "",
        thinkingModel: "gpt-5-mini",
      }),
    );

    const { result } = renderHook(() => useComponentSearchSettings());
    expect(result.current.config.model).toBe("");
  });

  it("falls back to defaults when stored JSON is malformed", () => {
    window.localStorage.setItem(STORAGE_KEY, "not json");

    const { result } = renderHook(() => useComponentSearchSettings());
    expect(result.current.config).toEqual({
      apiBase: "",
      apiKey: "",
      model: "",
    });
  });
});
