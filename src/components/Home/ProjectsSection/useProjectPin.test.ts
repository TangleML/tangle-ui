import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { useProjectPin } from "./useProjectPin";

const notify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

const project = { id: "p-1", name: "Churn model" };

afterEach(async () => {
  vi.clearAllMocks();
  await LibraryDB.favorites.clear();
});

describe("useProjectPin", () => {
  it("starts unpinned", async () => {
    const { result } = renderHook(() => useProjectPin(project));

    await waitFor(() => expect(result.current.pinned).toBe(false));
  });

  it("pins and unpins the same project", async () => {
    const { result } = renderHook(() => useProjectPin(project));
    await waitFor(() => expect(result.current.pinned).toBe(false));

    act(() => result.current.togglePin());
    await waitFor(() => expect(result.current.pinned).toBe(true));

    act(() => result.current.togglePin());
    await waitFor(() => expect(result.current.pinned).toBe(false));
  });

  it("says which way it went", async () => {
    const { result } = renderHook(() => useProjectPin(project));
    await waitFor(() => expect(result.current.pinned).toBe(false));

    act(() => result.current.togglePin());

    expect(notify).toHaveBeenCalledWith("Project pinned", "success");
  });

  /** The name rides along so the pinned list can be drawn before it loads. */
  it("keeps the project's name with the pin", async () => {
    const { result } = renderHook(() => useProjectPin(project));
    await waitFor(() => expect(result.current.pinned).toBe(false));

    act(() => result.current.togglePin());
    await waitFor(() => expect(result.current.pinned).toBe(true));

    await expect(LibraryDB.favorites.toArray()).resolves.toEqual([
      { type: "project", id: "p-1", name: "Churn model" },
    ]);
  });
});
