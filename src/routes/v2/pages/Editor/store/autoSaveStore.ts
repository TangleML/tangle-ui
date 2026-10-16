import {
  action,
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

import type { UndoStore } from "./undoStore";

const AUTOSAVE_MIN_SAVING_INDICATOR_MS = 600;

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor error: string | null = null;

  private spec: ComponentSpec | null = null;
  private file: PipelineFile | null = null;
  private disposeReaction: (() => void) | null = null;
  private lastSavedYaml: string | null = null;
  private pendingSave: { yaml: string; promise: Promise<void> } | null = null;
  private debouncedSave = debounce((yaml: string) => {
    void this.performSave(yaml).catch(() => {});
  }, AUTOSAVE_DEBOUNCE_TIME_MS);

  constructor(
    private undoStore: UndoStore,
    private onSaveError?: (error: Error) => void,
  ) {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, file: PipelineFile) {
    this.dispose();
    this.spec = spec;
    this.file = file;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.error = null;
    this.lastSavedYaml = this.serializeSpec();
    this.disposeReaction = reaction(
      () => this.serializeSpec(),
      (yaml) => {
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
    this.spec = null;
    this.file = null;
    this.pendingSave = null;
    this.isSaving = false;
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
      this.recordError(error);
      return null;
    }
  }

  @action private recordError(error: unknown) {
    this.error = error instanceof Error ? error.message : String(error);
  }

  private performSave(yaml: string): Promise<void> {
    const spec = this.spec;
    const file = this.file;
    const manager = this.undoStore.undoManager;
    if (!spec || !file) return Promise.resolve();
    if (this.pendingSave?.yaml === yaml) return this.pendingSave.promise;
    if (!this.pendingSave && yaml === this.lastSavedYaml) {
      runInAction(() => {
        this.error = null;
      });
      return Promise.resolve();
    }

    const job = { yaml, promise: Promise.resolve() };
    this.pendingSave = job;
    runInAction(() => {
      this.isSaving = true;
    });
    const idStack = collectIdStack(spec);
    const history = manager && { undoQueue: manager.undoQueue.slice() };
    const historyKey = getUndoHistoryKey(file);
    const write = async () => {
      await file.write(yaml);
      if (this.spec === spec && this.file === file) this.lastSavedYaml = yaml;
      if (history) {
        await saveUndoHistory(
          historyKey,
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
        if (this.pendingSave !== job) return;
        runInAction(() => {
          this.lastSavedAt = new Date();
          this.error = null;
        });
      })
      .catch((error) => {
        if (this.pendingSave === job) this.recordError(error);
        throw error;
      })
      .finally(() => {
        if (this.pendingSave === job) {
          this.pendingSave = null;
          runInAction(() => {
            this.isSaving = false;
          });
        }
      });
    return job.promise;
  }
}
