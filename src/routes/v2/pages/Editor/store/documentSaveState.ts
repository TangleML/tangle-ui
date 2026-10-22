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
  @observable accessor inFlightCount = 0;
  pendingSave: PendingSave | null = null;
  private readonly releases = new Set<() => void>();
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

  @computed get hasPendingWrites(): boolean {
    return this.inFlightCount > 0;
  }

  protectUnsavedChanges(): () => void {
    this.activeEditors += 1;
    this.disposeUnloadReaction ??= reaction(
      () => this.hasUnsavedChanges || this.hasPendingWrites,
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
    this.releases.add(release);
    this.releaseIfSaved();
  }

  releaseIfSaved(): void {
    if (this.hasUnsavedChanges || this.hasPendingWrites) return;
    const releases = [...this.releases];
    this.releases.clear();
    for (const release of releases) release();
    if (this.activeEditors === 0) {
      this.disposeUnloadReaction?.();
      this.disposeUnloadReaction = undefined;
      window.removeEventListener("beforeunload", this.preventUnload);
    }
  }

  @action recordError(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
  }
}
