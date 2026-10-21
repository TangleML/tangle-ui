import { action, computed, makeObservable, observable, reaction } from "mobx";

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
  private activeEditors = 0;
  private disposeUnloadReaction: (() => void) | undefined;
  private readonly preventUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };

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

  protectUnsavedChanges(): () => void {
    this.activeEditors += 1;
    this.disposeUnloadReaction ??= reaction(
      () => this.hasUnsavedChanges || this.isSaving,
      (unsaved) => {
        if (unsaved)
          window.addEventListener("beforeunload", this.preventUnload);
        else window.removeEventListener("beforeunload", this.preventUnload);
      },
      { fireImmediately: true },
    );
    return () => {
      this.activeEditors -= 1;
      this.releaseIfSaved();
    };
  }

  releaseWhenSaved(release: () => void): void {
    this.release = release;
    this.releaseIfSaved();
  }

  releaseIfSaved(): void {
    if (this.hasUnsavedChanges || this.isSaving) return;
    if (this.activeEditors === 0) {
      this.disposeUnloadReaction?.();
      this.disposeUnloadReaction = undefined;
      window.removeEventListener("beforeunload", this.preventUnload);
    }
    const release = this.release;
    this.release = undefined;
    release?.();
  }

  @action recordError(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
  }
}
