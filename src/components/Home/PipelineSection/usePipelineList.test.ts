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

const { storage, getLocalEntries, listRemote, listPending } = vi.hoisted(
  () => ({
    storage: {
      scope: "account-a",
      remoteEnabled: true,
      remoteListError: undefined as string | undefined,
      rootFolder: {
        assignFile: vi.fn<(name: string) => Promise<PipelineFile>>(),
      },
      filterVisibleLocalPipelines:
        vi.fn<(files: PipelineFile[]) => Promise<PipelineFile[]>>(),
      remote: undefined as
        | {
            list: () => Promise<PipelineFile[]>;
            listPending: () => Promise<PipelineFile[]>;
          }
        | undefined,
    },
    getLocalEntries: vi.fn<() => Promise<Map<string, ComponentFileEntry>>>(),
    listRemote: vi.fn<() => Promise<PipelineFile[]>>(),
    listPending: vi.fn<() => Promise<PipelineFile[]>>(),
  }),
);

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
    id: referenceId,
    referenceId,
    storageKind: referenceId.startsWith("pending:") ? "pending" : "local",
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
  storage.remote = { list: listRemote, listPending };
  storage.rootFolder.assignFile.mockImplementation(async (name) => file(name));
  storage.filterVisibleLocalPipelines.mockImplementation(
    async (files) => files,
  );
  getLocalEntries.mockResolvedValue(new Map());
  listRemote.mockResolvedValue([]);
  listPending.mockResolvedValue([]);
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

  it("keeps browser entries and never-uploaded drafts without listing server pipelines", async () => {
    const name = "Daily report";
    getLocalEntries.mockResolvedValue(new Map([[name, localEntry(name)]]));
    const pending = file(name, "pending:backend:report-id");
    listPending.mockResolvedValue([pending]);

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([...result.current.data!.pipelines.keys()]).toEqual([
      name,
      pending.referenceId,
    ]);
    expect(listRemote).not.toHaveBeenCalled();
    expect(listPending).toHaveBeenCalledOnce();
    expect(pending.read).toHaveBeenCalledOnce();
    expect(
      result.current.data?.pipelines.get(pending.referenceId),
    ).toMatchObject({
      name,
      modificationTime: modifiedAt,
      file: pending,
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

  it("keeps unreadable pending drafts visible and reports their recovery failure", async () => {
    const unreadable = file(
      "Unavailable report",
      "pending:backend:unavailable",
    );
    vi.mocked(unreadable.read).mockRejectedValue(
      new Error("Permission denied"),
    );
    const readable = file("Available report", "pending:backend:available");
    listPending.mockResolvedValue([unreadable, readable]);

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
    expect(listRemote).not.toHaveBeenCalled();
  });

  it("keeps local pipelines usable when the remote tab has a server error", async () => {
    storage.remoteListError = "Server unavailable";
    getLocalEntries.mockResolvedValue(
      new Map([["Local draft", localEntry("Local draft")]]),
    );

    const { result } = renderList();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([...result.current.data!.pipelines.keys()]).toEqual(["Local draft"]);
    expect(result.current.data?.error).toBe("");
    expect(listRemote).not.toHaveBeenCalled();
  });

  it.each(["write event", "upload retry"])(
    "removes a published local row after a %s refresh",
    async (refresh) => {
      const name = "Daily report";
      getLocalEntries.mockResolvedValue(new Map([[name, localEntry(name)]]));
      const { result, client } = renderList();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect([...result.current.data!.pipelines.keys()]).toEqual([name]);

      storage.filterVisibleLocalPipelines.mockResolvedValue([]);
      await act(async () => {
        if (refresh === "write event") emitUserPipelineWritten();
        else
          await client.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      });

      await waitFor(() => expect(result.current.data?.pipelines.size).toBe(0));
      expect(getLocalEntries).toHaveBeenCalledTimes(2);
      expect(listRemote).not.toHaveBeenCalled();
    },
  );

  it("invalidates remote list queries as well as the local list after a write", async () => {
    const { result, client } = renderList();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const remoteQueryKey = [
      ...FoldersQueryKeys.All(),
      "remote-list",
      storage.scope,
    ];
    client.setQueryData(remoteQueryKey, { files: [] });

    await act(async () => emitUserPipelineWritten());

    expect(client.getQueryState(remoteQueryKey)?.isInvalidated).toBe(true);
    await waitFor(() => expect(getLocalEntries).toHaveBeenCalledTimes(2));
  });

  it("does not expose previous-account drafts while the new scope is loading", async () => {
    const accountAFile = file("Account A report", "pending:backend:a");
    const accountBFile = file("Account B report", "pending:backend:b");
    listPending.mockResolvedValueOnce([accountAFile]);
    let finishLoading!: (files: PipelineFile[]) => void;
    listPending.mockReturnValueOnce(
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
    await waitFor(() => expect(listPending).toHaveBeenCalledTimes(2));
    await act(async () => finishLoading([accountBFile]));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([...result.current.data!.pipelines.keys()]).toEqual([
      accountBFile.referenceId,
    ]);
  });
});
