import { action, computed, makeObservable, observable } from "mobx";

interface PendingSave {
  yaml: string;
  promise: Promise<void>;
}

export class DocumentSaveState {
  @observable accessor currentYaml: string | null;
  @observable accessor lastSavedYaml: string | null;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor error: string | null = null;
  @observable accessor pendingCount = 0;
  pendingSave: PendingSave | null = null;
  private release: (() => void) | undefined;

  constructor(yaml: string | null) {
    this.currentYaml = yaml;
    this.lastSavedYaml = yaml;
    makeObservable(this);
  }

  @computed get hasUnsavedChanges(): boolean {
    return this.currentYaml === null || this.currentYaml !== this.lastSavedYaml;
  }

  @computed get isSaving(): boolean {
    return this.pendingCount > 0;
  }

  releaseWhenSaved(release: () => void): void {
    this.release = release;
    this.releaseIfSaved();
  }

  releaseIfSaved(): void {
    if (this.hasUnsavedChanges || this.isSaving) return;
    const release = this.release;
    this.release = undefined;
    release?.();
  }

  @action recordError(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
  }
}
