import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { FoldersQueryKeys } from "@/services/pipelineStorage/types";
import type { ComponentFileEntry } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { usePipelineList } from "./usePipelineList";

const { storage, getLocalEntries, listRemote } = vi.hoisted(() => ({
  storage: {
    scope: "account-a",
    remoteEnabled: true,
    remoteListError: undefined as string | undefined,
    rootFolder: {
      assignFile: vi.fn<(name: string) => Promise<PipelineFile>>(),
    },
    filterVisibleLocalPipelines:
      vi.fn<(files: PipelineFile[]) => Promise<PipelineFile[]>>(),
    remote: undefined as { list: () => Promise<PipelineFile[]> } | undefined,
  },
  getLocalEntries: vi.fn<() => Promise<Map<string, ComponentFileEntry>>>(),
  listRemote: vi.fn<() => Promise<PipelineFile[]>>(),
}));

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => storage,
}));
vi.mock("@/services/componentService", () => ({
  fetchComponentTextFromUrl: vi.fn(),
}));
vi.mock("@/utils/componentStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/componentStore")>()),
  getAllComponentFilesFromList: getLocalEntries,
}));

const clients: QueryClient[] = [];
const modifiedAt = new Date("2026-09-18T12:00:00Z");
const definition = {
  name: "Daily report",
  description: "Experiment tracking",
  metadata: { annotations: { author: "Alice Example", notes: "Run nightly" } },
  implementation: {
    graph: {
      tasks: { transform: { componentRef: { name: "Transform CSV" } } },
    },
  },
};

function file(name: string, referenceId = name): PipelineFile {
  return {
    referenceId,
    storageKey: name,
    displayName: name,
    modifiedAt,
    read: vi.fn().mockResolvedValue(JSON.stringify(definition)),
  } as unknown as PipelineFile;
}

function localEntry(name: string): ComponentFileEntry {
  return {
    name,
    creationTime: modifiedAt,
    modificationTime: modifiedAt,
    data: new ArrayBuffer(0),
    componentRef: {
      digest: "local-digest",
      text: JSON.stringify(definition),
      spec: definition,
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  storage.scope = "account-a";
  storage.remoteEnabled = true;
  storage.remoteListError = undefined;
  storage.remote = { list: listRemote };
  storage.rootFolder.assignFile.mockImplementation(async (name) => file(name));
  storage.filterVisibleLocalPipelines.mockImplementation(
    async (files) => files,
  );
  getLocalEntries.mockResolvedValue(new Map());
  listRemote.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { ...renderHook(() => usePipelineList(), { wrapper }), client };
}

describe("usePipelineList", () => {
  it("preserves legacy local entries and hides migrated backups", async () => {
    storage.remoteEnabled = false;
    storage.remote = undefined;
    const local = localEntry("Local draft");
    getLocalEntries.mockResolvedValue(
      new Map([
        ["Local draft", local],
        ["Migrated backup", localEntry("Migrated backup")],
      ]),
    );
    storage.filterVisibleLocalPipelines.mockImplementation(async (files) =>
      files.filter((entry) => entry.storageKey !== "Migrated backup"),
    );

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getLocalEntries).toHaveBeenCalledWith(USER_PIPELINES_LIST_NAME);
    expect(result.current.data?.pipelines).toEqual(
      new Map([["Local draft", { ...local, file: undefined }]]),
    );
    expect(
      result.current.data?.pipelines.get("Local draft")?.componentRef,
    ).toBe(local.componentRef);
    expect(listRemote).not.toHaveBeenCalled();
  });

  it("loads full remote definitions while retaining duplicate names by identity", async () => {
    const name = "Daily report";
    getLocalEntries.mockResolvedValue(new Map([[name, localEntry(name)]]));
    const remote = file(name, "remote:backend:report-id");
    listRemote.mockResolvedValue([remote]);

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([...result.current.data!.pipelines.keys()]).toEqual([
      name,
      remote.referenceId,
    ]);
    expect(remote.read).toHaveBeenCalledOnce();
    expect(
      result.current.data?.pipelines.get(remote.referenceId),
    ).toMatchObject({
      name,
      modificationTime: modifiedAt,
      file: remote,
      componentRef: {
        spec: definition,
        text: JSON.stringify(definition),
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(result.current.data?.pipelines.get(name)?.file?.referenceId).toBe(
      name,
    );
    expect(result.current.data?.error).toBe("");
  });

  it("keeps unreadable remote rows visible and reports the detail failure", async () => {
    const unreadable = file("Unavailable report", "remote:backend:unavailable");
    vi.mocked(unreadable.read).mockRejectedValue(
      new Error("Permission denied"),
    );
    const readable = file("Available report", "remote:backend:available");
    listRemote.mockResolvedValue([unreadable, readable]);

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pipelines.size).toBe(2);
    expect(result.current.data?.pipelines.get(unreadable.referenceId)).toEqual({
      name: "Unavailable report",
      modificationTime: modifiedAt,
      file: unreadable,
    });
    expect(
      result.current.data?.pipelines.get(readable.referenceId)?.componentRef
        ?.spec,
    ).toEqual(definition);
    expect(result.current.data?.error).toContain("Permission denied");
  });

  it("surfaces remote-list failures instead of reporting an ordinary empty list", async () => {
    storage.remoteListError = "Server unavailable";

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pipelines.size).toBe(0);
    expect(result.current.data?.error).toBe(
      "Could not load remote pipelines: Server unavailable",
    );
  });

  it.each(["write event", "upload retry"])(
    "replaces a migrated local row after a %s refresh",
    async (refresh) => {
      const name = "Daily report";
      getLocalEntries.mockResolvedValue(new Map([[name, localEntry(name)]]));
      const { result, client } = renderList();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect([...result.current.data!.pipelines.keys()]).toEqual([name]);

      const remote = file(name, "remote:backend:published-id");
      storage.filterVisibleLocalPipelines.mockResolvedValue([]);
      listRemote.mockResolvedValue([remote]);
      await act(async () => {
        if (refresh === "write event") emitUserPipelineWritten();
        else
          await client.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      });

      await waitFor(() =>
        expect([...result.current.data!.pipelines.keys()]).toEqual([
          remote.referenceId,
        ]),
      );
      expect(getLocalEntries).toHaveBeenCalledTimes(2);
      expect(result.current.data?.pipelines.get(remote.referenceId)?.file).toBe(
        remote,
      );
    },
  );

  it("does not expose previous-account rows while the new scope is loading", async () => {
    const accountAFile = file("Account A report", "remote:backend:a");
    const accountBFile = file("Account B report", "remote:backend:b");
    listRemote.mockResolvedValueOnce([accountAFile]);
    let finishLoading!: (files: PipelineFile[]) => void;
    listRemote.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
    );
    const { result, rerender } = renderList();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pipelines.has(accountAFile.referenceId)).toBe(
      true,
    );

    storage.scope = "account-b";
    rerender();

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(listRemote).toHaveBeenCalledTimes(2));
    await act(async () => finishLoading([accountBFile]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([...result.current.data!.pipelines.keys()]).toEqual([
      accountBFile.referenceId,
    ]);
  });
});
