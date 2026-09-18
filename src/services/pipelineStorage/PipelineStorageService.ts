import { makeObservable, observable } from "mobx";
import { z } from "zod";

import { REMOTE_PIPELINES_ENABLED } from "@/utils/remotePipelines";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import {
  assertLocalPipelineVisible,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import {
  type RemotePipelineOptions,
  RemotePipelineStore,
} from "./RemotePipelineStore";
import { type PipelineStorageDriver, ROOT_FOLDER_ID } from "./types";

const ROOT_DRIVER_CONFIG = {
  driverType: "folder-indexdb",
  folderId: ROOT_FOLDER_ID,
} as const;

export class PipelineStorageService {
  @observable accessor rootFolder: PipelineFolder;
  readonly remote?: RemotePipelineStore;
  readonly scope: string;

  get remoteEnabled(): boolean {
    return !!this.remote;
  }
  get remoteListError(): string | undefined {
    return this.remote?.listError;
  }

  constructor(remoteOptions?: RemotePipelineOptions) {
    this.rootFolder = createRoot({
      driver: createDriver(ROOT_DRIVER_CONFIG),
    });
    this.scope = remoteOptions
      ? `${remoteOptions.scope}:${crypto.randomUUID()}`
      : "local";
    if (remoteOptions)
      this.remote = new RemotePipelineStore(remoteOptions, this.rootFolder);
    makeObservable(this);
  }

  async createPipeline(
    name: string,
    content: string,
    source?: PipelineFile,
  ): Promise<PipelineFile> {
    return this.remote
      ? this.remote.create(name, content, source)
      : this.rootFolder.addFile(name, content);
  }

  canMigrate(file: PipelineFile): boolean {
    return (
      this.remoteEnabled &&
      file.storageKind === "local" &&
      ["root-indexdb", "folder-indexdb"].includes(file.folder.driver.type)
    );
  }

  async migratePipeline(file: PipelineFile): Promise<PipelineFile> {
    if (!this.remote || !this.canMigrate(file))
      throw new Error(
        "Only browser-local pipelines can be saved to the server.",
      );
    return this.remote.migrate(file);
  }

  private manageFile(file: PipelineFile): PipelineFile {
    if (this.canMigrate(file))
      file.resolveRedirect = () =>
        this.remote?.resolveLocal(file.id) ?? Promise.resolve(undefined);
    return file;
  }

  async filterVisibleLocalPipelines(
    files: PipelineFile[],
  ): Promise<PipelineFile[]> {
    const hiddenIds = new Set(
      (await remotePipelineRecoveryDb.copies.toArray())
        .filter((record) => record.migrated)
        .map((record) => record.localFileId),
    );
    return files
      .filter((file) => !hiddenIds.has(file.id))
      .map((file) => this.manageFile(file));
  }

  async listPipelines(folderId = ROOT_FOLDER_ID): Promise<PipelineFile[]> {
    const folder = await this.findFolderById(folderId);
    if (folderId === ROOT_FOLDER_ID) {
      const legacy = await new RootFolderDbStorageDriver().list();
      for (const descriptor of legacy) {
        if (!(await findByStorageKey(descriptor.storageKey)))
          await this.rootFolder.assignFile(descriptor.storageKey);
      }
    }
    const locals = await this.filterVisibleLocalPipelines(
      await folder.listPipelines(),
    );
    return folderId === ROOT_FOLDER_ID && this.remote
      ? [...locals, ...(await this.remote.list())]
      : locals;
  }

  async findPipelineById(id: string): Promise<PipelineFile> {
    const remote = await this.resolveRemoteReference(id);
    if (remote) return remote;
    const redirected = await this.remote?.resolveLocal(id);
    if (redirected) return redirected;
    await assertLocalPipelineVisible(id);
    const entry = await findById(id);
    if (!entry) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    return this.manageFile(
      new PipelineFile({
        id: entry.id,
        storageKey: entry.storageKey,
        folder: await this.findFolderById(entry.folderId),
      }),
    );
  }

  async resolvePipelineByName(name: string): Promise<PipelineFile | undefined> {
    const reference =
      this.remote && z.string().uuid().safeParse(name).success
        ? remotePipelineReference(this.remote.backendUrl, name)
        : name;
    const remote = await this.resolveRemoteReference(reference);
    if (remote) return remote;
    const existing = await findByStorageKey(name);

    if (!existing) {
      const file = await this.rootFolder.findFile(name);
      return file ? this.manageFile(file) : undefined;
    }

    const redirected = await this.remote?.resolveLocal(existing.id);
    if (redirected) return redirected;
    await assertLocalPipelineVisible(existing.id);

    const folder = await this.findFolderById(existing.folderId);

    const file = await folder.findFile(name);
    return file ? this.manageFile(file) : undefined;
  }

  private async resolveRemoteReference(
    reference: string,
  ): Promise<PipelineFile | undefined> {
    if (!reference.startsWith("remote:") && !reference.startsWith("pending:"))
      return undefined;
    if (!this.remote)
      throw new Error("Remote pipelines are not enabled for this deployment.");
    const file = await this.remote.resolve(reference);
    if (!file) throw new Error("Remote pipeline not found.");
    return file;
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

let activeService: PipelineStorageService | undefined;

export function setPipelineStorageService(
  service: PipelineStorageService,
): () => void {
  activeService = service;
  return () => {
    if (activeService === service) activeService = undefined;
  };
}

export function getPipelineStorageService(): PipelineStorageService {
  if (activeService) return activeService;
  if (REMOTE_PIPELINES_ENABLED)
    throw new Error("Pipeline storage is not ready.");
  return new PipelineStorageService();
}

function createRoot(options?: { driver: PipelineStorageDriver }) {
  return new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Root",
    parentId: null,
    driver: options?.driver ?? createDriver({ driverType: "root-indexdb" }),
  });
}
