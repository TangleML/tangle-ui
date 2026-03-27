import { action, makeObservable, observable, runInAction } from "mobx";

import { pipelineStorageDb } from "./db";
import type { PipelineFolder } from "./PipelineFolder";
import { deleteEntry, updateEntry } from "./pipelineRegistry";

interface PipelineFileInit {
  id: string;
  storageKey: string;
  folder: PipelineFolder;
  createdAt?: Date;
  modifiedAt?: Date;
}

export class PipelineFile {
  readonly id: string;
  readonly createdAt?: Date;
  readonly modifiedAt?: Date;

  @observable accessor storageKey: string;
  @observable accessor folder: PipelineFolder;

  constructor(options: PipelineFileInit) {
    this.id = options.id;
    this.storageKey = options.storageKey;
    this.folder = options.folder;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;

    makeObservable(this);
  }

  async read(): Promise<string> {
    return this.folder.driver.read(this.storageKey);
  }

  async write(content: string): Promise<void> {
    await this.folder.driver.write(this.storageKey, content);
  }

  @action
  async rename(newName: string): Promise<void> {
    await this.folder.driver.rename(this.storageKey, newName);
    await updateEntry(this.id, { storageKey: newName });

    runInAction(() => {
      this.storageKey = newName;
    });
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
