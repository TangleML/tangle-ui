import { action, makeObservable, observable, reaction } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  collectIdStack,
  serializePipelineDocumentToText,
} from "@/models/componentSpec";
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";
import { debounce } from "@/utils/debounce";
import { getErrorMessage } from "@/utils/string";

import type { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

const AUTOSAVE_MIN_SAVING_INDICATOR_MS = 600;

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor saveError: string | null = null;
  @observable accessor hasPendingChanges = false;

  private spec: ComponentSpec | null = null;
  private pipelineName: string | null = null;
  private disposeReaction: (() => void) | null = null;
  // Last content written to disk; used to skip a redundant flush on dispose.
  private lastSavedYaml: string | null = null;

  /**
   * Edits that storage has not accepted yet. A rejected write leaves them here
   * rather than dropping them, because the editor is then the only copy: the
   * store is retried until it takes them, and a user who stops editing after a
   * failure is not quietly left with unsaved work.
   */
  private pendingYaml: string | null = null;
  private inFlight: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private disposeRecovery: (() => void) | null = null;

  private debouncedSave = debounce((yamlText: string) => {
    void this.performSave(yamlText);
  }, AUTOSAVE_DEBOUNCE_TIME_MS);

  constructor(
    private undoStore: UndoStore,
    private pipelineFileStore: PipelineFileStore,
  ) {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, pipelineName: string) {
    this.dispose();
    this.spec = spec;
    this.pipelineName = pipelineName;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.saveError = null;
    this.hasPendingChanges = false;
    this.pendingYaml = null;
    this.retryAttempt = 0;
    // The freshly-loaded spec matches what's on disk, so seed the baseline to
    // avoid flushing an unchanged pipeline on dispose.
    this.lastSavedYaml = this.serializeSpec();

    this.disposeReaction = reaction(
      () => this.serializeSpec(),
      (yamlText) => this.scheduleAutoSave(yamlText),
      { fireImmediately: false },
    );

    this.watchForRecovery();
  }

  @action dispose() {
    const yaml = this.serializeSpec();
    const file = this.pipelineFileStore.activePipelineFile;
    if (yaml && file && yaml !== this.lastSavedYaml) {
      void file.write(yaml).catch((error) => {
        console.error("Auto-save flush on dispose failed:", error);
      });
    }
    this.debouncedSave.cancel();
    this.clearRetry();
    this.disposeRecovery?.();
    this.disposeRecovery = null;
    this.disposeReaction?.();
    this.disposeReaction = null;
    this.spec = null;
    this.pipelineName = null;
  }

  async save() {
    if (!this.spec || !this.pipelineName) return;
    const yamlText = this.serializeSpec();
    if (!yamlText) return;
    await this.performSave(yamlText);
  }

  @action setSaving(value: boolean) {
    this.isSaving = value;
  }

  @action setSaved(date: Date) {
    this.lastSavedAt = date;
    this.isSaving = false;
    this.saveError = null;
  }

  @action private setSaveError(message: string) {
    this.saveError = message;
    this.isSaving = false;
  }

  @action private setPending(value: boolean) {
    this.hasPendingChanges = value;
  }

  private serializeSpec(): string | null {
    if (!this.spec) return null;
    try {
      return serializePipelineDocumentToText(this.spec);
    } catch {
      return null;
    }
  }

  private scheduleAutoSave(yamlText: string | null) {
    if (!yamlText || !this.pipelineName) {
      this.debouncedSave.cancel();
      return;
    }
    this.debouncedSave(yamlText);
  }

  private async performSave(yamlText: string) {
    if (!this.pipelineName) return;

    this.pendingYaml = yamlText;
    this.setPending(true);
    this.clearRetry();

    // A second save starting mid-write would race the first one to the store,
    // and the loser is whichever the store happens to finish last. Later edits
    // wait and are picked up by the write already running.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.drainPending();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async drainPending(): Promise<void> {
    while (this.pendingYaml !== null) {
      const yamlText = this.pendingYaml;
      const outcome = await this.writeOnce(yamlText);

      if (typeof outcome === "string") {
        this.setSaveError(outcome);
        this.scheduleRetry();
        return;
      }

      this.setSaved(outcome);
      this.retryAttempt = 0;
      if (this.pendingYaml === yamlText) this.pendingYaml = null;
    }

    this.setPending(false);
  }

  private async writeOnce(yamlText: string): Promise<Date | string> {
    const pipelineName = this.pipelineName;
    this.setSaving(true);

    const savePromise = (async () => {
      try {
        const file = this.pipelineFileStore.activePipelineFile;
        if (!file) {
          throw new Error(`No open file to save "${pipelineName}" to.`);
        }

        await file.write(yamlText);
        await this.persistUndoHistory();
        this.lastSavedYaml = yamlText;
        return new Date();
      } catch (error) {
        console.error("Auto-save failed:", error);
        return getErrorMessage(error);
      }
    })();

    const minDisplayPromise = new Promise((resolve) =>
      setTimeout(resolve, AUTOSAVE_MIN_SAVING_INDICATOR_MS),
    );

    const [outcome] = await Promise.all([savePromise, minDisplayPromise]);
    return outcome;
  }

  private scheduleRetry() {
    this.clearRetry();

    const delay =
      RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => void this.flushPending(), delay);
  }

  private clearRetry() {
    if (this.retryTimer === null) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private async flushPending(): Promise<void> {
    if (this.pendingYaml === null || this.inFlight) return;

    this.inFlight = this.drainPending();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  /**
   * Coming back online or back to the tab is the cheapest signal that a store
   * that refused a write a moment ago might take it now, and it beats waiting
   * out the backoff.
   */
  private watchForRecovery() {
    if (typeof window === "undefined") return;

    const retryNow = () => void this.flushPending();
    window.addEventListener("online", retryNow);
    window.addEventListener("focus", retryNow);

    this.disposeRecovery = () => {
      window.removeEventListener("online", retryNow);
      window.removeEventListener("focus", retryNow);
    };
  }

  private async persistUndoHistory() {
    const fileId = this.pipelineFileStore.activePipelineFile?.id;
    if (!this.spec || !fileId) return;
    const manager = this.undoStore.undoManager;
    if (!manager) return;

    try {
      const idStack = collectIdStack(this.spec);
      await saveUndoHistory(fileId, idStack, manager);
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }
}
