import {
  isRootStore,
  registerRootStore,
  type UndoManager,
  undoMiddleware,
  unregisterRootStore,
} from "mobx-keystone";

import {
  type ComponentSpec,
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import { hydrateLoadedSpecRefs } from "@/routes/v2/pages/Editor/utils/hydrateSpecRefs";
import { PipelineSpecApiError } from "@/services/pipelineSpecService";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import { normalizeBackendUrl } from "@/utils/backendIdentity";
import type { ComponentSpec as SerializedSpec } from "@/utils/componentSpec";

import { PipelineFile } from "./PipelineFile";
import {
  assertRemotePipelineAvailable,
  getRemotePipelineDeletionError,
  RemotePipelineDeletionError,
  subscribeRemotePipelineDeletion,
} from "./remotePipelineDeletion";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
} from "./types";

export interface LoadedSpec {
  spec: ComponentSpec;
  file: PipelineFile;
  saveState: DocumentSaveState;
  undoManager: UndoManager;
}

interface DocumentEntry {
  ref: EditorPipelineRef;
  file?: PipelineFile;
  opening?: Promise<PipelineFile>;
  loading?: Promise<LoadedSpec>;
  document?: LoadedSpec;
  error?: unknown;
  owners: number;
  releaseRequested?: boolean;
}
interface SavedDraftAlias {
  remote: RemotePipelineRef;
  ownerId: string;
  unavailable?: boolean;
}

/** Owns every open document, independently of routes, editor mounts, and query caches. */
export class PipelineStorageService {
  private readonly documents = new Map<string, DocumentEntry>();
  private readonly savedDrafts = new Map<string, SavedDraftAlias>();
  private readonly listeners = new Set<() => void>();
  private stopDeletion?: () => void;
  private connections = 0;

  connect = (): (() => void) => {
    this.connections += 1;
    this.stopDeletion ??= subscribeRemotePipelineDeletion((deletion) => {
      if (deletion.state !== "deleted" && deletion.state !== "uncertain")
        return;
      for (const entry of new Set(this.documents.values()))
        void this.reconcile(entry);
    });
    return () => {
      this.connections -= 1;
      if (!this.connections) {
        this.stopDeletion?.();
        this.stopDeletion = undefined;
      }
    };
  };
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    const disconnect = this.connect();
    return () => {
      this.listeners.delete(listener);
      disconnect();
    };
  };
  private changed() {
    for (const listener of this.listeners) listener();
  }

  private entry(ref: EditorPipelineRef): DocumentEntry {
    const key = getEditorPipelineIdentity(ref);
    const cached = this.documents.get(key);
    if (cached) return cached;
    if (ref.source === "draft") {
      const saved = this.getSavedDraft(ref.draftId, ref.backendUrl);
      if (saved) {
        const entry = this.entry(saved.remote);
        this.documents.set(key, entry);
        return entry;
      }
      this.createRemoteDraft(ref);
      return this.documents.get(key)!;
    }
    const entry: DocumentEntry = { ref, owners: 0 };
    this.documents.set(key, entry);
    return entry;
  }

  async resolvePipeline(ref: EditorPipelineRef): Promise<PipelineFile> {
    const entry = this.entry(ref);
    if (ref.source === "draft") {
      const saved = this.getSavedDraft(ref.draftId, ref.backendUrl);
      if (saved?.unavailable)
        throw new Error(
          "This saved pipeline is no longer available. Open the dashboard or create a new pipeline.",
        );
      if (saved) await this.assertDraftOwner(ref.backendUrl, saved.ownerId);
    }
    if (entry.file) {
      assertRemotePipelineAvailable(
        ref.backendUrl,
        entry.file.remote ?? { filePath: entry.file.filePath },
      );
      return entry.file;
    }
    if (entry.ref.source !== "remote")
      throw new Error("Pipeline draft is unavailable.");
    entry.opening ??= PipelineFile.open(entry.ref)
      .then((file) => {
        entry.file = file;
        return file;
      })
      .catch((error) => {
        entry.opening = undefined;
        if (
          ref.source === "draft" &&
          ((error instanceof PipelineSpecApiError && error.status === 404) ||
            (error instanceof RemotePipelineDeletionError &&
              error.state === "deleted"))
        ) {
          const saved = this.getSavedDraft(ref.draftId, ref.backendUrl);
          if (saved)
            this.storeSavedDraft(getEditorPipelineIdentity(ref), {
              ...saved,
              unavailable: true,
            });
        }
        throw error;
      });
    return entry.opening;
  }

  loadDocument(ref: EditorPipelineRef): Promise<LoadedSpec> {
    const entry = this.entry(ref);
    if (entry.document) {
      const remote = entry.file?.remote;
      const blocked =
        remote &&
        getRemotePipelineDeletionError({ source: "remote", ...remote });
      if (
        blocked &&
        !entry.document.saveState.hasUnsavedChanges &&
        !entry.document.saveState.hasPendingWrites
      )
        this.invalidate(entry, blocked);
      else if (blocked) entry.document.saveState.recordError(blocked);
    }
    entry.loading ??= this.resolvePipeline(ref)
      .then(async (file) => {
        const spec = new YamlDeserializer(
          new IncrementingIdGenerator(),
        ).deserialize(file.read());
        registerRootStore(spec);
        try {
          await hydrateLoadedSpecRefs(spec);
        } catch (error) {
          unregisterRootStore(spec);
          throw error;
        }
        const document = {
          spec,
          file,
          undoManager: undoMiddleware(spec),
          saveState: new DocumentSaveState(spec, file, () =>
            this.releaseIfSaved(entry),
          ),
        };
        entry.document = document;
        if (entry.releaseRequested) this.releaseIfSaved(entry);
        return document;
      })
      .catch((error) => {
        entry.error = error;
        if (entry.releaseRequested) this.releaseIfSaved(entry);
        throw error;
      });
    return entry.loading;
  }

  retryDocument(ref: EditorPipelineRef): void {
    const entry = this.documents.get(getEditorPipelineIdentity(ref));
    if (!entry?.error) return;
    this.disposeDocument(entry);
    entry.file = undefined;
    entry.opening = undefined;
    entry.loading = undefined;
    entry.error = undefined;
  }

  retainDocument(ref: EditorPipelineRef): () => void {
    const entry = this.entry(ref);
    entry.owners += 1;
    entry.releaseRequested = false;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.owners -= 1;
      queueMicrotask(() => {
        if (entry.owners) return;
        entry.releaseRequested = true;
        if (entry.document)
          void entry.document.saveState.flush().catch(() => {});
        this.releaseIfSaved(entry);
      });
    };
  }

  private releaseIfSaved(entry: DocumentEntry): void {
    if (entry.loading && !entry.document && !entry.error) return;
    if (
      entry.owners ||
      entry.document?.saveState.hasUnsavedChanges ||
      entry.document?.saveState.hasPendingWrites
    )
      return;
    this.remove(entry);
  }
  private remove(entry: DocumentEntry): void {
    for (const [key, candidate] of this.documents)
      if (candidate === entry) this.documents.delete(key);
    this.disposeDocument(entry);
  }
  private disposeDocument(entry: DocumentEntry): void {
    entry.document?.saveState.dispose();
    entry.document?.undoManager.dispose();
    if (entry.document && isRootStore(entry.document.spec))
      unregisterRootStore(entry.document.spec);
    entry.document = undefined;
  }
  private invalidate(entry: DocumentEntry, error: Error): void {
    if (
      entry.error === error ||
      entry.error instanceof RemotePipelineDeletionError
    )
      return;
    entry.error = error;
    entry.loading = Promise.reject(error);
    void entry.loading.catch(() => {});
  }
  private async reconcile(entry: DocumentEntry): Promise<void> {
    await entry.document?.saveState.pendingSave?.promise.catch(() => {});
    const remote = entry.file?.remote;
    const error =
      remote && getRemotePipelineDeletionError({ source: "remote", ...remote });
    if (!error || !entry.document) return;
    if (entry.document.saveState.hasUnsavedChanges)
      entry.document.saveState.recordError(error);
    else this.invalidate(entry, error);
    this.changed();
  }

  createRemoteDraft(
    ref: RemotePipelineDraftRef,
    onCreated?: (remote: RemotePipelineRef) => Promise<unknown>,
  ): PipelineFile {
    const entry: DocumentEntry = { ref, owners: 0 };
    const file = new PipelineFile({
      ref,
      onCreated: async (remote) => {
        entry.ref = remote;
        this.documents.set(getEditorPipelineIdentity(remote), entry);
        if (file.ownerId)
          this.storeSavedDraft(getEditorPipelineIdentity(ref), {
            remote,
            ownerId: file.ownerId,
          });
        try {
          await onCreated?.(remote);
        } catch (cause) {
          throw new Error(
            "Pipeline saved, but it could not be attached to the project. Retry to attach the saved pipeline.",
            { cause },
          );
        }
      },
    });
    entry.file = file;
    this.documents.set(getEditorPipelineIdentity(ref), entry);
    return file;
  }

  getRemoteDraftRef(
    draftId: string,
    backendUrl: string,
  ): RemotePipelineDraftRef {
    const key = getEditorPipelineIdentity({
      source: "draft",
      draftId,
      backendUrl,
      name: "",
    });
    const entry = this.documents.get(key);
    if (entry?.ref.source === "draft") return entry.ref;
    if (this.getSavedDraft(draftId, backendUrl))
      return { source: "draft", draftId, backendUrl, name: "Saved pipeline" };
    throw new Error(
      "This unsaved pipeline draft is no longer available. Close this tab and create a new pipeline.",
    );
  }

  getFile(ref: EditorPipelineRef): PipelineFile | undefined {
    return this.documents.get(getEditorPipelineIdentity(ref))?.file;
  }

  discardRemoteDraft(ref: RemotePipelineDraftRef): void {
    const entry = this.documents.get(getEditorPipelineIdentity(ref));
    if (entry && !entry.owners) {
      entry.releaseRequested = true;
      this.releaseIfSaved(entry);
    }
  }

  async createRemotePipeline(
    backendUrl: string,
    name: string,
    spec: SerializedSpec,
  ): Promise<PipelineFile> {
    const file = await PipelineFile.create(backendUrl, name, spec);
    this.documents.set(
      getEditorPipelineIdentity({ source: "remote", ...file.remote! }),
      { ref: { source: "remote", ...file.remote! }, file, owners: 0 },
    );
    return file;
  }
  async copyRemotePipeline(
    source: PipelineFile,
    name: string,
    spec: SerializedSpec,
  ): Promise<PipelineFile> {
    const file = await source.copy(name, spec);
    this.documents.set(
      getEditorPipelineIdentity({ source: "remote", ...file.remote! }),
      { ref: { source: "remote", ...file.remote! }, file, owners: 0 },
    );
    return file;
  }
  private getSavedDraft(
    draftId: string,
    backendUrl: string,
  ): SavedDraftAlias | undefined {
    const key = getEditorPipelineIdentity({
      source: "draft",
      draftId,
      backendUrl,
      name: "",
    });
    const saved = this.savedDrafts.get(key);
    if (saved) return saved;
    try {
      const value: unknown = JSON.parse(
        sessionStorage.getItem(`saved-draft:${key}`) ?? "null",
      );
      if (
        !value ||
        typeof value !== "object" ||
        !("remote" in value) ||
        !("ownerId" in value)
      )
        return;
      const remote = value.remote;
      if (
        !remote ||
        typeof remote !== "object" ||
        !("source" in remote) ||
        remote.source !== "remote" ||
        !("backendUrl" in remote) ||
        typeof remote.backendUrl !== "string" ||
        normalizeBackendUrl(remote.backendUrl) !==
          normalizeBackendUrl(backendUrl) ||
        !("pipelineId" in remote) ||
        typeof remote.pipelineId !== "string" ||
        !remote.pipelineId.trim() ||
        typeof value.ownerId !== "string" ||
        !value.ownerId
      )
        return;
      const alias: SavedDraftAlias = {
        remote: { source: "remote", backendUrl, pipelineId: remote.pipelineId },
        ownerId: value.ownerId,
        unavailable: "unavailable" in value && value.unavailable === true,
      };
      this.savedDrafts.set(key, alias);
      return alias;
    } catch {
      // Ignore unavailable storage or stale malformed history entries.
    }
  }

  private storeSavedDraft(key: string, value: SavedDraftAlias): void {
    this.savedDrafts.set(key, value);
    try {
      sessionStorage.setItem(`saved-draft:${key}`, JSON.stringify(value));
    } catch {
      // The current session still retains the alias when storage is unavailable.
    }
  }

  private async assertDraftOwner(
    backendUrl: string,
    ownerId: string,
  ): Promise<void> {
    if ((await getRemotePipelineWriter(backendUrl)) !== ownerId) {
      throw new Error(
        "This draft was saved under another account. Switch back to that account or open a pipeline from the dashboard.",
      );
    }
  }
}
