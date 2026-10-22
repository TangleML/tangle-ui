import { action, makeObservable, observable, runInAction } from "mobx";

import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { emitPipelineFileChanged } from "./pipelineFileEvents";
import type { PipelineFolder } from "./PipelineFolder";
import { deleteEntry, updateEntry } from "./pipelineRegistry";
import { getEditorPipelineIdentity, type RemotePipelineRef } from "./types";

interface PipelineFileInit {
  id: string;
  storageKey: string;
  folder: PipelineFolder;
  createdAt?: Date;
  modifiedAt?: Date;
  remote?: Omit<RemotePipelineRef, "source">;
  draftBackendUrl?: string;
}

export class PipelineFile {
  readonly initialId: string;
  readonly createdAt?: Date;
  readonly modifiedAt?: Date;
  readonly draftBackendUrl?: string;
  @observable.ref accessor remote:
    Readonly<Omit<RemotePipelineRef, "source">> | undefined;

  get id(): string {
    return this.remote?.pipelineId ?? this.initialId;
  }

  get isDraft(): boolean {
    return Boolean(this.draftBackendUrl && !this.remote);
  }

  get editingError(): Error | undefined {
    return this.folder.driver.editingError;
  }

  @observable accessor storageKey: string;
  @observable accessor folder: PipelineFolder;

  constructor(options: PipelineFileInit) {
    this.initialId = options.id;
    this.draftBackendUrl = options.draftBackendUrl;
    this.storageKey = options.storageKey;
    this.folder = options.folder;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
    this.remote = options.remote && Object.freeze({ ...options.remote });

    makeObservable(this);
  }

  @action
  promoteToRemote(remote: Omit<RemotePipelineRef, "source">): void {
    this.remote = Object.freeze({
      backendUrl: remote.backendUrl,
      pipelineId: remote.pipelineId,
    });
  }

  async read(): Promise<string> {
    return this.folder.driver.read(this.storageKey);
  }

  async write(content: string): Promise<void> {
    await this.folder.driver.write(this.storageKey, content);
    emitPipelineFileChanged({
      storageKey: this.remote
        ? getEditorPipelineIdentity({ source: "remote", ...this.remote })
        : this.storageKey,
      source: "v2",
    });
    emitUserPipelineWritten();
  }

  @action
  async rename(newName: string): Promise<void> {
    await this.folder.driver.rename(this.storageKey, newName);
    if (!this.remote && !this.isDraft)
      await updateEntry(this.id, { storageKey: newName });

    runInAction(() => {
      this.storageKey = newName;
    });
    emitUserPipelineWritten();
  }

  @action
  async moveTo(targetFolder: PipelineFolder): Promise<void> {
    if (!this.folder.canMoveFilesOut) {
      throw new Error(`Cannot move files out of folder "${this.folder.name}"`);
    }
    if (!targetFolder.canAcceptFiles) {
      throw new Error(
        `Folder "${targetFolder.name}" does not accept moved files`,
      );
    }

    this.folder = targetFolder;
    await updateEntry(this.id, { folderId: targetFolder.id });
  }

  @action
  async deleteFile(): Promise<void> {
    await this.folder.driver.delete(this.storageKey);
    await deleteEntry(this.id);
  }
}
