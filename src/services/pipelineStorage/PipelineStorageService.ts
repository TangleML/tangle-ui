import { makeObservable, observable } from "mobx";

import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";
import { componentSpecFromYaml } from "@/utils/yaml";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { RemotePipelineDraftStorageDriver } from "./drivers/RemotePipelineDraftStorageDriver";
import { RemotePipelineStorageDriver } from "./drivers/RemotePipelineStorageDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import {
  migrateLocalPipelineToRemote,
  type PipelineMigrationOptions,
} from "./migrateLocalPipelineToRemote";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findPipelineMigration } from "./pipelineMigrations";
import { findById, findByStorageKey } from "./pipelineRegistry";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
  isRemotePipelineRef,
  type PipelineStorageDriver,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
  ROOT_FOLDER_ID,
} from "./types";

const ROOT_DRIVER_CONFIG = {
  driverType: "folder-indexdb",
  folderId: ROOT_FOLDER_ID,
} as const;

export class PipelineStorageService {
  private readonly savedDrafts = new Map<string, RemotePipelineRef>();
  private readonly remoteDrafts = new Map<
    string,
    {
      ref: RemotePipelineDraftRef;
      file: PipelineFile;
      owners: number;
      discardRequested: boolean;
    }
  >();
  @observable accessor rootFolder: PipelineFolder;

  constructor() {
    this.rootFolder = createRoot({
      driver: createDriver(ROOT_DRIVER_CONFIG),
    });
    makeObservable(this);
  }

  async resolvePipeline(ref: EditorPipelineRef): Promise<PipelineFile> {
    if (isRemotePipelineDraftRef(ref)) {
      const draft = this.remoteDrafts.get(getEditorPipelineIdentity(ref));
      if (draft) {
        draft.discardRequested = false;
        return draft.file;
      }
      const saved = this.getSavedDraft(ref.draftId, ref.backendUrl);
      if (saved) return this.resolvePipeline(saved);
      const file = this.createRemoteDraft(ref);
      const created = this.remoteDrafts.get(getEditorPipelineIdentity(ref));
      if (created) created.discardRequested = false;
      return file;
    }
    if (isRemotePipelineRef(ref)) {
      return remoteFile(await RemotePipelineStorageDriver.open(ref));
    }

    const file = ref.fileId
      ? await this.findPipelineById(ref.fileId)
      : await this.resolvePipelineByName(ref.name);
    if (file) return file;

    const legacyDriver = new RootFolderDbStorageDriver();
    if (await legacyDriver.hasKey(ref.name)) {
      return this.rootFolder.assignFile(ref.name);
    }
    const migration = await findPipelineMigration(ref);
    if (migration) {
      return this.resolvePipeline(migration.remote);
    }
    throw new Error(`Pipeline "${ref.name}" not found`);
  }

  createRemoteDraft(
    ref: RemotePipelineDraftRef,
    onCreated?: (remote: RemotePipelineRef) => Promise<unknown>,
  ): PipelineFile {
    const filePath = `pipelines/${crypto.randomUUID()}.yaml`;
    const driver = new RemotePipelineDraftStorageDriver(
      ref,
      (content) =>
        this.createRemoteDriver(
          ref.backendUrl,
          componentSpecFromYaml(content).name ?? ref.name,
          content,
          filePath,
        ),
      async (remote) => {
        file.promoteToRemote(remote);
        const key = getEditorPipelineIdentity(ref);
        this.savedDrafts.set(key, remote);
        try {
          sessionStorage.setItem(`saved-draft:${key}`, JSON.stringify(remote));
        } catch {
          // In-memory history recovery still works when browser storage is full.
        }
        try {
          await onCreated?.(remote);
        } catch (cause) {
          throw new Error(
            "Pipeline saved, but it could not be attached to the project. Retry to attach the saved pipeline.",
            { cause },
          );
        }
      },
    );
    const file = new PipelineFile({
      id: ref.draftId,
      storageKey: ref.name,
      draftBackendUrl: ref.backendUrl,
      folder: new PipelineFolder({
        id: getEditorPipelineIdentity(ref),
        name: "Remote pipelines",
        parentId: null,
        driver,
      }),
    });
    this.remoteDrafts.set(getEditorPipelineIdentity(ref), {
      ref,
      file,
      owners: 0,
      discardRequested: true,
    });
    return file;
  }

  getRemoteDraftRef(
    draftId: string,
    backendUrl: string,
  ): RemotePipelineDraftRef | RemotePipelineRef {
    const draft = [...this.remoteDrafts.values()].find(
      ({ ref }) => ref.draftId === draftId && ref.backendUrl === backendUrl,
    );
    if (draft) return draft.ref;
    const saved = this.getSavedDraft(draftId, backendUrl);
    if (saved) return saved;
    throw new Error(
      "This unsaved pipeline draft is no longer available. Close this tab and create a new pipeline.",
    );
  }

  private getSavedDraft(
    draftId: string,
    backendUrl: string,
  ): RemotePipelineRef | undefined {
    const key = getEditorPipelineIdentity({
      source: "draft",
      draftId,
      backendUrl,
      name: "",
    });
    const saved = this.savedDrafts.get(key);
    if (saved) return saved;
    try {
      const value = JSON.parse(
        sessionStorage.getItem(`saved-draft:${key}`) ?? "null",
      );
      if (
        value?.source === "remote" &&
        value.backendUrl === backendUrl &&
        typeof value.pipelineId === "string"
      ) {
        this.savedDrafts.set(key, value);
        return value;
      }
    } catch {
      // Ignore unavailable storage or stale malformed history entries.
    }
  }

  discardRemoteDraft(ref: RemotePipelineDraftRef): void {
    const identity = getEditorPipelineIdentity(ref);
    const draft = this.remoteDrafts.get(identity);
    if (!draft) return;
    draft.discardRequested = true;
    if (!draft.owners) this.remoteDrafts.delete(identity);
  }

  /** Retained workarea tabs outlive their mounted editor when sessions change. */
  retainRemoteDraft(draftId: string) {
    const draft = [...this.remoteDrafts.values()].find(
      ({ ref }) => ref.draftId === draftId,
    );
    if (!draft) return;
    draft.owners += 1;
    let released = false;
    return {
      ref: draft.ref,
      file: draft.file,
      release: () => {
        if (released) return;
        released = true;
        draft.owners -= 1;
        // Effect cleanup may be followed by a StrictMode reconnect. Dirty
        // documents stay available until their editor requests clean disposal.
        queueMicrotask(() => {
          const identity = getEditorPipelineIdentity(draft.ref);
          if (
            !draft.owners &&
            draft.discardRequested &&
            this.remoteDrafts.get(identity) === draft
          ) {
            this.remoteDrafts.delete(identity);
          }
        });
      },
    };
  }

  async createRemotePipeline(
    backendUrl: string,
    name: string,
    content: string,
    filePath?: string,
  ): Promise<PipelineFile> {
    const file = remoteFile(
      await this.createRemoteDriver(backendUrl, name, content, filePath),
    );
    emitUserPipelineWritten();
    return file;
  }

  private createRemoteDriver(
    backendUrl: string,
    name: string,
    content: string,
    filePath?: string,
  ): Promise<RemotePipelineStorageDriver> {
    return RemotePipelineStorageDriver.create(
      backendUrl,
      name,
      content,
      filePath,
    );
  }

  async moveLocalPipelineToRemote(
    pipeline: string | PipelineFile,
    backendUrl: string,
    onCreated?: (remote: PipelineFile) => Promise<unknown>,
    options?: PipelineMigrationOptions,
  ): Promise<PipelineFile> {
    const local =
      typeof pipeline === "string"
        ? await this.resolvePipeline({ name: pipeline })
        : pipeline;
    return migrateLocalPipelineToRemote(
      this,
      local,
      backendUrl,
      onCreated,
      options,
    );
  }

  async copyRemotePipeline(
    source: PipelineFile,
    name: string,
    content: string,
  ): Promise<PipelineFile> {
    const driver = source.folder.driver;
    if (driver instanceof RemotePipelineDraftStorageDriver && source.remote) {
      return remoteFile(await driver.copy(name, content));
    }
    if (!(driver instanceof RemotePipelineStorageDriver)) {
      throw new Error("The source pipeline is not a remote document.");
    }
    return remoteFile(await driver.copy(name, content));
  }

  async findPipelineById(id: string): Promise<PipelineFile> {
    const entry = await findById(id);
    if (!entry) {
      const migration = await findPipelineMigration({ name: id, fileId: id });
      if (migration) return this.resolvePipeline(migration.remote);
      throw new Error(`Pipeline not found: ${id}`);
    }

    return new PipelineFile({
      id: entry.id,
      storageKey: entry.storageKey,
      folder: await this.findFolderById(entry.folderId),
    });
  }

  async resolvePipelineByName(name: string): Promise<PipelineFile | undefined> {
    const existing = await findByStorageKey(name);

    if (!existing) return this.rootFolder.findFile(name);

    const folder = await this.findFolderById(existing.folderId);

    return folder.findFile(name);
  }

  async findFolderById(id: string): Promise<PipelineFolder> {
    if (id === ROOT_FOLDER_ID) {
      return this.rootFolder;
    }

    return PipelineFolder.resolveById(id);
  }

  async getAllFolders(): Promise<PipelineFolder[]> {
    const entries = await pipelineStorageDb.folders.toArray();
    return entries.map((entry) => PipelineFolder.fromEntry(entry));
  }

  async getFavoriteFolders(): Promise<PipelineFolder[]> {
    const entries = await pipelineStorageDb.folders
      .filter((f) => f.favorite === true)
      .toArray();
    return entries
      .map((entry) => PipelineFolder.fromEntry(entry))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

function createRoot(options?: { driver: PipelineStorageDriver }) {
  return new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Root",
    parentId: null,
    driver: options?.driver ?? createDriver({ driverType: "root-indexdb" }),
  });
}

function remoteFile(driver: RemotePipelineStorageDriver): PipelineFile {
  const remote = {
    backendUrl: driver.backendUrl,
    pipelineId: driver.pipelineId,
  };
  return new PipelineFile({
    id: driver.pipelineId,
    storageKey: driver.name,
    remote,
    folder: new PipelineFolder({
      id: getEditorPipelineIdentity({ source: "remote", ...remote }),
      name: "Remote pipelines",
      parentId: null,
      driver,
    }),
  });
}
