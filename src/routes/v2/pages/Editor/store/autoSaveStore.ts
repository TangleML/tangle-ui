import {
  action,
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  collectIdStack,
  serializeComponentSpecToText,
} from "@/models/componentSpec";
import {
  getUndoHistoryKey,
  saveUndoHistory,
} from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";
import { debounce } from "@/utils/debounce";

import { DocumentSaveState } from "./documentSaveState";
import type { UndoStore } from "./undoStore";

const AUTOSAVE_MIN_SAVING_INDICATOR_MS = 600;

export class AutoSaveStore {
  @observable.ref private accessor document: DocumentSaveState | null = null;

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

  private spec: ComponentSpec | null = null;
  private file: PipelineFile | null = null;
  private disposeReaction: (() => void) | null = null;
  private releaseUnloadProtection: (() => void) | null = null;
  private debouncedSave = debounce((yaml: string) => {
    void this.performSave(yaml).catch(() => {});
  }, AUTOSAVE_DEBOUNCE_TIME_MS);

  constructor(
    private undoStore: UndoStore,
    private onSaveError?: (error: Error) => void,
  ) {
    makeObservable(this);
  }

  @action init(
    spec: ComponentSpec,
    file: PipelineFile,
    document?: DocumentSaveState,
  ) {
    this.dispose();
    this.spec = spec;
    this.file = file;
    this.document = document ?? new DocumentSaveState(this.serializeSpec());
    this.releaseUnloadProtection = this.document.protectUnsavedChanges();
    this.disposeReaction = reaction(
      () => this.serializeSpec(),
      (yaml) => {
        runInAction(() => {
          if (this.document) this.document.currentYaml = yaml;
        });
        if (yaml === null) this.debouncedSave.cancel();
        else this.debouncedSave(yaml);
      },
    );
  }

  @action dispose() {
    void this.save().catch((error) => {
      console.error("Auto-save flush on dispose failed:", error);
      this.onSaveError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
    this.disposeReaction?.();
    this.disposeReaction = null;
    this.releaseUnloadProtection?.();
    this.releaseUnloadProtection = null;
    this.spec = null;
    this.file = null;
    this.document = null;
  }

  async save(): Promise<void> {
    this.debouncedSave.cancel();
    if (!this.spec || !this.file) return;
    const yaml = this.serializeSpec();
    if (yaml === null)
      throw new Error(this.error ?? "Could not serialize pipeline");
    await this.performSave(yaml);
  }

  private serializeSpec(): string | null {
    if (!this.spec) return null;
    try {
      return serializeComponentSpecToText(this.spec);
    } catch (error) {
      this.document?.recordError(error);
      return null;
    }
  }

  private performSave(yaml: string): Promise<void> {
    const spec = this.spec;
    const file = this.file;
    const document = this.document;
    const manager = this.undoStore.undoManager;
    if (!spec || !file || !document) return Promise.resolve();
    if (document.pendingSave?.yaml === yaml)
      return document.pendingSave.promise;
    runInAction(() => {
      document.currentYaml = yaml;
    });
    if (!document.isSaving && yaml === document.lastSavedYaml) {
      runInAction(() => {
        document.error = null;
      });
      document.releaseIfSaved();
      return Promise.resolve();
    }

    const job = { yaml, promise: Promise.resolve() };
    document.pendingSave = job;
    runInAction(() => {
      document.pendingCount += 1;
    });
    const idStack = collectIdStack(spec);
    const history = manager && { undoQueue: manager.undoQueue.slice() };
    const historyKey = file.isDraft ? undefined : getUndoHistoryKey(file);
    const write = async () => {
      try {
        await file.write(yaml);
      } catch (error) {
        // A failed response does not prove that the server rejected the write.
        runInAction(() => {
          document.lastSavedYaml = null;
        });
        throw error;
      }
      runInAction(() => {
        document.lastSavedYaml = yaml;
      });
      if (history) {
        await saveUndoHistory(
          historyKey ?? getUndoHistoryKey(file),
          idStack,
          history,
          file.remote ? yaml : undefined,
        ).catch((error) =>
          console.error("Failed to persist undo history:", error),
        );
      }
    };
    job.promise = Promise.all([
      write(),
      new Promise((resolve) =>
        setTimeout(resolve, AUTOSAVE_MIN_SAVING_INDICATOR_MS),
      ),
    ])
      .then(() => {
        if (document.pendingSave !== job) return;
        runInAction(() => {
          document.lastSavedAt = new Date();
          document.error = null;
        });
      })
      .catch((error) => {
        if (document.pendingSave === job) document.recordError(error);
        throw error;
      })
      .finally(() => {
        if (document.pendingSave === job) document.pendingSave = null;
        runInAction(() => {
          document.pendingCount -= 1;
        });
        document.releaseIfSaved();
      });
    return job.promise;
  }
}
