import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  type LoadedSpec,
  PipelineStorageService,
} from "@/services/pipelineStorage/PipelineStorageService";
import {
  draftPipelineIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";
import {
  getRemotePipelineWriter,
  writeRemotePipelineDocument,
} from "@/services/remotePipelineEditorService";

import { observeWorkareaPipelineDrafts } from "./observeWorkareaPipelineDrafts";

vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/routes/v2/pages/Editor/utils/hydrateSpecRefs", () => ({
  hydrateLoadedSpecRefs: vi.fn(),
}));
vi.mock("@/services/remotePipelineEditorService", async (original) => ({
  ...(await original<
    typeof import("@/services/remotePipelineEditorService")
  >()),
  getRemotePipelineWriter: vi.fn(),
  writeRemotePipelineDocument: vi.fn(),
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
const documents: LoadedSpec[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(getRemotePipelineWriter).mockResolvedValue("owner");
  vi.mocked(writeRemotePipelineDocument).mockImplementation(
    async (_backend, filePath, input) => ({
      id: remote.pipelineId,
      user_id: "owner",
      pipeline_name: "Draft",
      file_path: filePath,
      ...input,
    }),
  );
});
afterEach(async () => {
  for (const dispose of disposers.splice(0)) dispose();
  await Promise.resolve();
  for (const document of documents.splice(0)) {
    document.saveState.dispose();
    document.undoManager.dispose();
  }
  vi.useRealTimers();
});

async function setup() {
  const store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-a");
  const storage = new PipelineStorageService();
  storage.createRemoteDraft(draft);
  const tab = store.openResolvedView({
    title: draft.name,
    target: {
      type: "pipeline",
      identity: draftPipelineIdentity(draft.draftId),
    },
  });
  disposers.push(
    observeWorkareaPipelineDrafts(store, storage, draft.backendUrl),
  );
  const document = await storage.loadDocument(draft);
  documents.push(document);
  return { store, storage, document, tab };
}

describe("workarea document ownership", () => {
  it("retains an untouched tab across session switches and releases it on close", async () => {
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
    expect(writeRemotePipelineDocument).not.toHaveBeenCalled();
  });

  it("promotes an inactive tab without replacing its model, save state, or undo history", async () => {
    const { store, storage, document, tab } = await setup();
    document.spec.setDescription("Edited");
    store.selectSession("session-b");
    const other = store.openResolvedView({
      title: "Other",
      target: { type: "pipeline", identity: remotePipelineIdentity("other") },
    });
    await document.saveState.save();
    expect(store.activeSessionId).toBe("session-b");
    expect(store.workareaTabs).toEqual([other]);
    expect(store.activeWorkareaTabId).toBe(other.id);
    expect(await storage.loadDocument(remote)).toBe(document);
    expect(document.undoManager.canUndo).toBe(true);
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
    store.selectSession("session-b");
    await Promise.resolve();
    expect(storage.getFile(remote)).toBe(document.file);
    store.dropSession("session-a");
    await Promise.resolve();
    expect(storage.getFile(remote)).toBeUndefined();
  });

  it("releases drafts when their owning session is dropped", async () => {
    const { store, storage } = await setup();
    store.selectSession("session-b");
    store.dropSession("session-a");
    await Promise.resolve();
    expect(() =>
      storage.getRemoteDraftRef(draft.draftId, draft.backendUrl),
    ).toThrow("no longer available");
  });

  it("keeps failed edits after a tab closes without resurrecting the tab when retry succeeds", async () => {
    const { store, storage, document, tab } = await setup();
    const successfulWrite = vi
      .mocked(writeRemotePipelineDocument)
      .getMockImplementation()!;
    vi.mocked(writeRemotePipelineDocument).mockRejectedValue(
      new Error("Unavailable"),
    );
    document.spec.setDescription("Keep me");
    await expect(document.saveState.save()).rejects.toThrow("Unavailable");
    store.closeWorkareaTab(tab.id);
    await Promise.resolve();
    await document.saveState.pendingSave?.promise.catch(() => {});
    expect(storage.getFile(draft)).toBe(document.file);
    vi.mocked(writeRemotePipelineDocument).mockImplementation(successfulWrite);
    await document.saveState.save();
    expect(store.workareaTabs).toEqual([]);
    expect(storage.getFile(remote)).toBeUndefined();
  });
});
