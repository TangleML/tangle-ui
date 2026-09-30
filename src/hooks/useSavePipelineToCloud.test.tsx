import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { useSavePipelineToCloud } from "./useSavePipelineToCloud";

const { storage, notify } = vi.hoisted(() => ({
  storage: {
    remoteEnabled: true,
    canMigrate: vi.fn(),
    migratePipeline: vi.fn(),
  },
  notify: vi.fn(),
}));

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("./useToastNotification", () => ({ default: () => notify }));

const clients: QueryClient[] = [];
let file: PipelineFile;

beforeEach(() => {
  vi.resetAllMocks();
  storage.remoteEnabled = true;
  storage.canMigrate.mockReturnValue(true);
  storage.migratePipeline.mockResolvedValue(undefined);
  file = {
    id: "local-id",
    displayName: "Daily report",
    storageKind: "local",
    canEdit: true,
    isSaving: false,
    retry: vi.fn().mockResolvedValue(undefined),
  } as unknown as PipelineFile;
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

function renderSaveHook() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(() => useSavePipelineToCloud(file), { wrapper }),
    client,
  };
}

describe("useSavePipelineToCloud", () => {
  it("migrates the actual file and refreshes the list after success", async () => {
    const { result, client } = renderSaveHook();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    act(() => result.current.save());

    await waitFor(() =>
      expect(storage.migratePipeline).toHaveBeenCalledWith(file),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Pipeline saved to server",
        "success",
      ),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pipeline-folders"] });
  });

  it.each(["disabled deployment", "unsupported driver", "non-owner"])(
    "does not save for %s",
    (reason) => {
      if (reason === "disabled deployment") storage.remoteEnabled = false;
      if (reason === "unsupported driver")
        storage.canMigrate.mockReturnValue(false);
      if (reason === "non-owner") Object.assign(file, { canEdit: false });
      const { result } = renderSaveHook();

      act(() => result.current.save());

      expect(result.current.isSupported).toBe(false);
      expect(storage.migratePipeline).not.toHaveBeenCalled();
    },
  );

  it("blocks repeated clicks before React rerenders", async () => {
    let finish!: () => void;
    storage.migratePipeline.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderSaveHook();

    act(() => {
      result.current.save();
      result.current.save();
    });

    await waitFor(() => expect(storage.migratePipeline).toHaveBeenCalledOnce());
    expect(result.current.isPending).toBe(true);
    await act(async () => finish());
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it.each(["pending", "remote"])(
    "retries an unsaved %s file without migrating it again",
    async (kind) => {
      Object.assign(file, { storageKind: kind, saveError: "Offline" });
      storage.canMigrate.mockReturnValue(false);
      const { result } = renderSaveHook();

      act(() => result.current.save());

      await waitFor(() => expect(file.retry).toHaveBeenCalledOnce());
      expect(result.current.isRetry).toBe(true);
      expect(storage.migratePipeline).not.toHaveBeenCalled();
    },
  );

  it("does not expose a save button for an already-saved remote file", () => {
    Object.assign(file, { storageKind: "remote" });
    storage.canMigrate.mockReturnValue(false);
    const { result } = renderSaveHook();

    expect(result.current.isSupported).toBe(false);
  });

  it("reports a failure and permits an explicit retry", async () => {
    storage.migratePipeline.mockRejectedValueOnce(
      new Error("Permission denied"),
    );
    const { result } = renderSaveHook();

    act(() => result.current.save());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Could not save pipeline to server: Permission denied",
        "error",
      ),
    );
    expect(storage.migratePipeline).toHaveBeenCalledOnce();

    act(() => result.current.save());
    await waitFor(() =>
      expect(storage.migratePipeline).toHaveBeenCalledTimes(2),
    );
  });
});
