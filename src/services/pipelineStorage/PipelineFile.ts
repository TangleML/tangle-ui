import { action, makeObservable, observable, runInAction } from "mobx";

import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { emitPipelineFileChanged } from "./pipelineFileEvents";
import type { PipelineFolder } from "./PipelineFolder";
import { withPipelineLock } from "./pipelineLock";
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
  @observable.ref accessor redirectedFile: PipelineFile | undefined;
  resolveRedirect?: () => Promise<PipelineFile | undefined>;

  get canEdit(): boolean {
    return this.redirectedFile?.canEdit ?? true;
  }
  get storageKind(): "local" | "remote" | "pending" {
    return this.redirectedFile?.storageKind ?? "local";
  }
  get displayName(): string {
    return this.redirectedFile?.displayName ?? this.storageKey;
  }
  get referenceId(): string {
    return this.redirectedFile?.referenceId ?? this.storageKey;
  }
  get saveError(): string | undefined {
    return this.redirectedFile?.saveError;
  }
  get isSaving(): boolean {
    return this.redirectedFile?.isSaving ?? false;
  }

  async retry(): Promise<void> {
    await this.redirectedFile?.retry();
  }
  async persistRecovery(content: string): Promise<void> {
    await this.redirectedFile?.persistRecovery(content);
  }

  private async redirect(): Promise<PipelineFile | undefined> {
    const file = (await this.resolveRedirect?.()) ?? this.redirectedFile;
    if (file)
      runInAction(() => {
        this.redirectedFile = file;
      });
    return file;
  }

  constructor(options: PipelineFileInit) {
    this.id = options.id;
    this.storageKey = options.storageKey;
    this.folder = options.folder;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;

    makeObservable(this);
  }

  async read(): Promise<string> {
    const redirect = await this.redirect();
    if (redirect) return redirect.read();
    return this.folder.driver.read(this.storageKey);
  }

  async write(content: string): Promise<void> {
    await withPipelineLock(this.id, async () => {
      const redirect = await this.redirect();
      if (redirect) return redirect.write(content);
      await this.folder.driver.write(this.storageKey, content);
    });
    emitPipelineFileChanged({ storageKey: this.storageKey, source: "v2" });
    emitUserPipelineWritten();
  }

  @action
  async rename(newName: string): Promise<void> {
    return withPipelineLock(this.id, async () => {
      const redirect = await this.redirect();
      if (redirect) return redirect.rename(newName);
      await this.folder.driver.rename(this.storageKey, newName);
      await updateEntry(this.id, { storageKey: newName });

      runInAction(() => {
        this.storageKey = newName;
      });
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
    return withPipelineLock(this.id, async () => {
      const redirect = await this.redirect();
      if (redirect) return redirect.deleteFile();
      await this.folder.driver.delete(this.storageKey);
      await deleteEntry(this.id);
    });
  }
}
