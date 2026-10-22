import {
  action,
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from "mobx";

import {
  type ComponentSpec,
  serializeComponentSpec,
} from "@/models/componentSpec";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  getRemotePipelineDeletionError,
  RemotePipelineDeletionError,
} from "@/services/pipelineStorage/remotePipelineDeletion";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";
import { debounce } from "@/utils/debounce";

interface SaveSnapshot {
  spec: ReturnType<typeof serializeComponentSpec>;
  fingerprint: string;
}

/** Save state belongs to the document, including while no editor is mounted. */
export class DocumentSaveState {
  @observable accessor currentSnapshot: string | null;
  @observable accessor lastSavedSnapshot: string | null;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor error: string | null = null;
  @observable accessor pendingCount = 0;
  pendingSave: { fingerprint: string; promise: Promise<void> } | null = null;
  private readonly stopWatching: () => void;
  private readonly stopUnloadProtection: () => void;
  private readonly preventUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  private readonly debouncedSave = debounce((snapshot: SaveSnapshot) => {
    void this.performSave(snapshot).catch(() => {});
  }, AUTOSAVE_DEBOUNCE_TIME_MS);

  constructor(
    readonly spec: ComponentSpec,
    readonly file: PipelineFile,
    private readonly onSettled: () => void = () => {},
  ) {
    this.currentSnapshot = this.lastSavedSnapshot =
      this.snapshot()?.fingerprint ?? null;
    makeObservable(this);
    this.stopWatching = reaction(
      () => this.snapshot(),
      (snapshot) => {
        runInAction(() => {
          this.currentSnapshot = snapshot?.fingerprint ?? null;
        });
        if (snapshot) this.debouncedSave(snapshot);
        else this.debouncedSave.cancel();
      },
    );
    this.stopUnloadProtection = reaction(
      () => this.hasUnsavedChanges || this.hasPendingWrites,
      (unsaved) => {
        if (unsaved)
          window.addEventListener("beforeunload", this.preventUnload);
        else window.removeEventListener("beforeunload", this.preventUnload);
      },
      { fireImmediately: true },
    );
  }

  @computed get hasUnsavedChanges(): boolean {
    return (
      this.currentSnapshot === null ||
      this.currentSnapshot !== this.lastSavedSnapshot
    );
  }
  @computed get isSaving(): boolean {
    return this.pendingCount > 0;
  }
  @computed get hasPendingWrites(): boolean {
    return this.isSaving;
  }

  async save(createDraft = true): Promise<void> {
    this.debouncedSave.cancel();
    const snapshot = this.snapshot();
    if (!snapshot)
      throw new Error(this.error ?? "Could not serialize pipeline");
    await this.performSave(snapshot, createDraft && this.file.isDraft);
  }

  flush(): Promise<void> {
    this.debouncedSave.cancel();
    if (
      this.file.remote &&
      getRemotePipelineDeletionError({ source: "remote", ...this.file.remote })
    )
      return Promise.resolve();
    return this.save(false);
  }

  private snapshot(): SaveSnapshot | null {
    try {
      const spec = serializeComponentSpec(this.spec);
      return { spec, fingerprint: JSON.stringify(spec) };
    } catch (error) {
      this.recordError(error);
      return null;
    }
  }

  private performSave(
    snapshot: SaveSnapshot,
    createDraft = false,
  ): Promise<void> {
    const { fingerprint } = snapshot;
    if (this.pendingSave?.fingerprint === fingerprint)
      return this.pendingSave.promise;
    runInAction(() => {
      this.currentSnapshot = fingerprint;
    });
    if (
      !createDraft &&
      !this.hasPendingWrites &&
      fingerprint === this.lastSavedSnapshot
    ) {
      runInAction(() => {
        this.error = null;
      });
      return Promise.resolve();
    }
    const job = { fingerprint, promise: Promise.resolve() };
    this.pendingSave = job;
    runInAction(() => {
      this.pendingCount += 1;
    });
    job.promise = this.file
      .write(snapshot.spec)
      .then(() => {
        runInAction(() => {
          this.lastSavedSnapshot = fingerprint;
          if (this.pendingSave === job) {
            this.lastSavedAt = new Date();
            this.error = null;
          }
        });
      })
      .catch((error) => {
        // A lost response can still mean the server accepted the write.
        runInAction(() => {
          if (!(error instanceof RemotePipelineDeletionError))
            this.lastSavedSnapshot = null;
          if (this.pendingSave === job) this.recordError(error);
        });
        throw error;
      })
      .finally(() => {
        if (this.pendingSave === job) this.pendingSave = null;
        runInAction(() => {
          this.pendingCount -= 1;
        });
        this.onSettled();
      });
    return job.promise;
  }

  @action releaseRecoveredCopy(
    file: PipelineFile,
    fingerprint: string,
  ): boolean {
    if (
      file !== this.file ||
      this.hasPendingWrites ||
      this.snapshot()?.fingerprint !== fingerprint
    )
      return false;
    this.debouncedSave.cancel();
    this.lastSavedSnapshot = fingerprint;
    this.error = null;
    this.onSettled();
    return true;
  }

  @action recordError(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
  }

  dispose(): void {
    this.debouncedSave.cancel();
    this.stopWatching();
    this.stopUnloadProtection();
    window.removeEventListener("beforeunload", this.preventUnload);
  }
}
