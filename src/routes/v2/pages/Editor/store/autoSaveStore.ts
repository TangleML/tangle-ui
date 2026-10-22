import { action, computed, makeObservable, observable } from "mobx";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import type { DocumentSaveState } from "./documentSaveState";

/** The mounted editor points at its document's save state. */
export class AutoSaveStore {
  @observable.ref private accessor document: DocumentSaveState | null = null;

  constructor(private onSaveError?: (error: Error) => void) {
    makeObservable(this);
  }

  @computed get isSaving(): boolean {
    return this.document?.isSaving ?? false;
  }
  @computed get lastSavedAt(): Date | null {
    return this.document?.lastSavedAt ?? null;
  }
  @computed get error(): string | null {
    return this.document?.error ?? null;
  }
  @computed get hasUnsavedChanges(): boolean {
    return this.document?.hasUnsavedChanges ?? false;
  }

  @action init(document: DocumentSaveState) {
    this.dispose();
    this.document = document;
  }

  @action dispose() {
    void this.document?.flush().catch((error) => {
      this.onSaveError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
    this.document = null;
  }

  save(): Promise<void> {
    return this.document?.save() ?? Promise.resolve();
  }

  releaseRecoveredCopy(file: PipelineFile, snapshot: string): boolean {
    return this.document?.releaseRecoveredCopy(file, snapshot) ?? false;
  }
}
