import { action, makeObservable, observable, runInAction } from "mobx";

import type { ArgumentType } from "@/utils/componentSpec";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { emitPipelineFileChanged } from "./pipelineFileEvents";
import type { PipelineFolder } from "./PipelineFolder";
import { withPipelineLock } from "./pipelineLock";
import { deleteEntry, updateEntry } from "./pipelineRegistry";
import type { PipelineFileDescriptor } from "./types";

interface PipelineFileInit extends PipelineFileDescriptor {
  id: string;
  folder: PipelineFolder;
}

export class PipelineFile {
  readonly id: string;
  readonly createdAt?: Date;
  readonly modifiedAt?: Date;

  @observable accessor storageKey: string;
  @observable accessor folder: PipelineFolder;
  @observable.ref accessor redirectedFile: PipelineFile | undefined;
  @observable private accessor fileDisplayName: string | undefined;
  private readonly editable: boolean;
  resolveRedirect?: () => Promise<PipelineFile | undefined>;
  stageLocalRecovery?: (content: string) => Promise<void>;
  readLocalRecovery?: () => Promise<string | undefined>;

  get canEdit(): boolean {
    return this.redirectedFile?.canEdit ?? this.editable;
  }
  get storageKind(): "local" | "remote" | "pending" {
    return this.redirectedFile?.storageKind ?? "local";
  }
  get displayName(): string {
    return (
      this.redirectedFile?.displayName ??
      this.fileDisplayName ??
      this.storageKey
    );
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
  get savedTaskArguments(): Record<string, ArgumentType> {
    return this.redirectedFile?.savedTaskArguments ?? {};
  }
  get secretsOwner(): string | undefined {
    return this.redirectedFile?.secretsOwner;
  }

  async retry(): Promise<void> {
    await this.redirectedFile?.retry();
  }
  async persistRecovery(content: string): Promise<void> {
    if (this.redirectedFile) {
      await this.redirectedFile.persistRecovery(content);
    } else {
      await this.stageLocalRecovery?.(content);
    }
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
    this.fileDisplayName = options.displayName;
    this.editable = options.canEdit ?? true;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;

    makeObservable(this);
  }

  async read(): Promise<string> {
    const redirect = await this.redirect();
    if (redirect) return redirect.read();
    const recovery = await this.readLocalRecovery?.();
    if (recovery !== undefined) return recovery;
    const result = await this.folder.driver.read(this.storageKey);
    return typeof result === "string" ? result : result.content;
  }

  async write(content: string): Promise<void> {
    if (!this.canEdit) throw new Error("This pipeline is read-only.");
    if (!this.redirectedFile && this.stageLocalRecovery)
      await this.stageLocalRecovery(content);
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
    if (!this.canEdit) throw new Error("This pipeline is read-only.");
    return withPipelineLock(this.id, async () => {
      const redirect = await this.redirect();
      if (redirect) return redirect.rename(newName);
      const saved = await this.folder.driver.rename(this.storageKey, newName);
      const storageKey = saved?.storageKey ?? newName;
      await updateEntry(this.id, { storageKey });

      runInAction(() => {
        this.storageKey = storageKey;
        this.fileDisplayName = saved?.displayName ?? newName;
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
    if (!this.canEdit) throw new Error("This pipeline is read-only.");
    return withPipelineLock(this.id, async () => {
      const redirect = await this.redirect();
      if (redirect) return redirect.deleteFile();
      await this.folder.driver.delete(this.storageKey);
      await deleteEntry(this.id);
    });
  }
}
