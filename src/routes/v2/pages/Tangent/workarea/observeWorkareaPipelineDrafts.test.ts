import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { getEditorPipelineIdentity } from "@/services/pipelineStorage/types";
import {
  draftPipelineIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";

import { observeWorkareaPipelineDrafts } from "./observeWorkareaPipelineDrafts";

vi.mock("@/services/pipelineStorage/createDriver", () => ({
  createDriver: () => ({}),
}));
vi.mock("@/services/localPipelines/localPipelinesService", () => ({
  availablePipelineName: async (name: string) => name,
}));
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/routes/v2/pages/Editor/hooks/useLoadSpec", () => ({
  EDITOR_SPEC_QUERY_KEY: "editor-v2-spec",
}));
vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/sections/components/ExportPipelineButton",
  () => ({ exportPipeline: vi.fn() }),
);

const draft = {
  source: "draft",
  backendUrl: "https://backend.example.com",
  draftId: "draft-1",
  name: "Draft",
} as const;
const remote = {
  source: "remote",
  backendUrl: draft.backendUrl,
  pipelineId: "remote-1",
} as const;
const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

async function setup() {
  const store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-a");
  const storage = new PipelineStorageService();
  const file = await storage.resolvePipeline(draft);
  const queryClient = new QueryClient();
  const tab = store.openResolvedView({
    title: draft.name,
    target: {
      type: "pipeline",
      identity: draftPipelineIdentity(draft.draftId),
    },
  });
  disposers.push(
    () => queryClient.clear(),
    observeWorkareaPipelineDrafts(store, storage, queryClient),
  );
  return { store, storage, file, queryClient, tab };
}

describe("workarea pipeline draft ownership", () => {
  it("keeps an unsaved tab available across session switches and releases it on close", async () => {
    const { store, storage, tab } = await setup();
    store.selectSession("session-b");
    storage.discardRemoteDraft(draft);
    await Promise.resolve();
    expect(storage.getRemoteDraftRef(draft.draftId, draft.backendUrl)).toBe(
      draft,
    );
    store.selectSession("session-a");
    expect(store.workareaTabs).toEqual([tab]);
    store.closeWorkareaTab(tab.id);
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("promotes the owning session and hands off the complete live document", async () => {
    vi.useFakeTimers();
    const { store, storage, file, queryClient, tab } = await setup();
    const loaded = {
      spec: new ComponentSpec({ name: draft.name }),
      file,
      restoredUndoStore: { undoEvents: [{ event: "edited" }] },
      saveState: { pendingCount: 1 },
    };
    queryClient.setQueryData(
      ["editor-v2-spec", getEditorPipelineIdentity(draft)],
      loaded,
    );
    store.selectSession("session-b");
    const other = store.openResolvedView({
      title: "Other",
      target: { type: "pipeline", identity: remotePipelineIdentity("other") },
    });
    file.promoteToRemote(remote);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(store.activeSessionId).toBe("session-b");
    expect(store.workareaTabs).toEqual([other]);
    expect(store.activeWorkareaTabId).toBe(other.id);
    expect(
      queryClient.getQueryData([
        "editor-v2-spec",
        getEditorPipelineIdentity(remote),
      ]),
    ).toBe(loaded);
    store.selectSession("session-a");
    expect(store.workareaTabs).toEqual([
      {
        ...tab,
        target: {
          type: "pipeline",
          identity: remotePipelineIdentity(remote.pipelineId),
        },
      },
    ]);
    expect(store.activeWorkareaTabId).toBe(tab.id);
    storage.discardRemoteDraft(draft);
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("releases drafts when their owning session is dropped", async () => {
    const { store, storage } = await setup();
    store.selectSession("session-b");
    storage.discardRemoteDraft(draft);
    store.dropSession("session-a");
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("does not resurrect a tab when its save finishes after closing", async () => {
    const { store, file, tab, queryClient } = await setup();
    store.closeWorkareaTab(tab.id);
    file.promoteToRemote(remote);
    expect(store.workareaTabs).toEqual([]);
    expect(
      queryClient.getQueryData([
        "editor-v2-spec",
        getEditorPipelineIdentity(remote),
      ]),
    ).toBeUndefined();
  });
});
