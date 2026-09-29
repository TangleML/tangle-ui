import { describe, expect, it, vi } from "vitest";

import { listStoragePage } from "./listStoragePage";
import type { PipelineStorageDriver } from "./types";

function driver(): PipelineStorageDriver {
  return {
    type: "test",
    allowsMoveIn: false,
    allowsMoveOut: false,
    list: vi.fn().mockResolvedValue([
      { storageKey: "first", id: "one", displayName: "Same name" },
      { storageKey: "second", id: "two", displayName: "Same name" },
      { storageKey: "third", canEdit: false },
    ]),
    read: vi.fn(),
    write: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    hasKey: vi.fn(),
  };
}

describe("storage pagination", () => {
  it("pages existing drivers without conflating names and identity", async () => {
    const storage = driver();
    const first = await listStoragePage(storage, { pageSize: 2 });
    expect(first).toEqual({
      files: [
        { storageKey: "first", id: "one", displayName: "Same name" },
        { storageKey: "second", id: "two", displayName: "Same name" },
      ],
      totalCount: 3,
      nextPageToken: "2",
    });
    expect(
      await listStoragePage(storage, {
        pageSize: 2,
        pageToken: first.nextPageToken,
      }),
    ).toEqual({
      files: [{ storageKey: "third", canEdit: false }],
      totalCount: 3,
      nextPageToken: undefined,
    });
  });

  it("passes opaque cursors and cancellation to paginated drivers", async () => {
    const storage = driver();
    const page = { files: [], nextPageToken: "next", totalCount: 25 };
    storage.listPage = vi.fn().mockResolvedValue(page);
    const options = {
      pageToken: "opaque-token",
      pageSize: 10,
      signal: new AbortController().signal,
    };
    expect(await listStoragePage(storage, options)).toBe(page);
    expect(storage.listPage).toHaveBeenCalledExactlyOnceWith(options);
    expect(storage.list).not.toHaveBeenCalled();
  });

  it.each(["-1", "NaN", "1.5", "", "01"])(
    "rejects invalid local cursor %j",
    async (pageToken) => {
      const storage = driver();
      await expect(listStoragePage(storage, { pageToken })).rejects.toThrow(
        "Invalid pipeline page",
      );
      expect(storage.list).not.toHaveBeenCalled();
    },
  );

  it("does not return a local page after cancellation", async () => {
    const storage = driver();
    const controller = new AbortController();
    vi.mocked(storage.list).mockImplementation(async () => {
      controller.abort();
      return [];
    });
    await expect(
      listStoragePage(storage, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
