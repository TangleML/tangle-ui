import { action, makeObservable, observable, reaction } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  collectIdStack,
  serializePipelineDocumentToText,
} from "@/models/componentSpec";
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import {
  forgetPendingWrite,
  recordPendingWrite,
} from "@/services/pipelineStorage/pendingWrites";
import {
  isExpiredSession,
  isWriteWorthRetrying,
} from "@/services/pipelineStorage/storageErrors";
import {
  isStorageAnswering,
  subscribeStorageHealth,
} from "@/services/pipelineStorage/storageHealth";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";
import { debounce } from "@/utils/debounce";
import { getErrorMessage } from "@/utils/string";

import type { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

const AUTOSAVE_MIN_SAVING_INDICATOR_MS = 600;

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

/**
 * Which editor session speaks for a pipeline right now. A session that closes
 * holding work the store refused keeps trying, and this is what stops it
 * putting that older text back over a session that has since reopened the same
 * pipeline and saved something newer.
 */
const speakingFor = new Map<string, AutoSaveStore>();

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor saveError: string | null = null;
  @observable accessor hasPendingChanges = false;
  @observable accessor sessionExpired = false;

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
  private closed = false;

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
    this.sessionExpired = false;
    this.pendingYaml = null;
    this.retryAttempt = 0;
    this.closed = false;
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
    /**
     * The parting write goes through the queue rather than straight to the
     * file. Sent on its own it would race whatever write is already running,
     * and a slow store finishing them out of order would leave the older text
     * as the stored one.
     */
    this.closed = true;

    const yaml = this.serializeSpec();
    if (yaml && yaml !== this.lastSavedYaml) {
      this.pendingYaml = yaml;
      void this.flushPending();
    }

    this.debouncedSave.cancel();
    this.clearRetry();
    this.disposeReaction?.();
    this.disposeReaction = null;
    this.spec = null;
    this.pipelineName = null;

    /**
     * Work the store has not taken outlives the editor that made it: leaving
     * the page to go and fix the connection is the most likely thing someone
     * does next, and it must not be what loses the edit.
     */
    if (this.pendingYaml === null) this.stopWatching();
  }

  private stopWatching() {
    this.clearRetry();
    this.disposeRecovery?.();
    this.disposeRecovery = null;
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
    this.sessionExpired = false;
  }

  @action private setSaveError(error: Error) {
    this.saveError = getErrorMessage(error);
    this.sessionExpired = isExpiredSession(error);
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

      if (outcome === "stood-down") {
        this.pendingYaml = null;
        break;
      }

      if (outcome instanceof Error) {
        this.setSaveError(outcome);
        if (isWriteWorthRetrying(outcome)) this.scheduleRetry();
        return;
      }

      this.setSaved(outcome);
      this.retryAttempt = 0;
      if (this.pendingYaml === yamlText) this.pendingYaml = null;
    }

    this.setPending(false);
    if (this.closed) this.stopWatching();
  }

  private async writeOnce(
    yamlText: string,
  ): Promise<Date | Error | "stood-down"> {
    const pipelineName = this.pipelineName;
    const open = this.pipelineFileStore.activePipelineFile;

    if (open) {
      if (this.closed && speakingFor.get(open.storageKey) !== this) {
        return "stood-down";
      }
      speakingFor.set(open.storageKey, this);
    }

    this.setSaving(true);

    const savePromise = (async () => {
      const file = this.pipelineFileStore.activePipelineFile;

      try {
        if (!file) {
          throw new Error(`No open file to save "${pipelineName}" to.`);
        }

        await file.write(yamlText);
        await forgetPendingWrite(file);
        await this.persistUndoHistory();
        this.lastSavedYaml = yamlText;
        return new Date();
      } catch (error) {
        console.error("Auto-save failed:", error);
        /**
         * Held where a reload cannot lose it. The in-memory retry below is the
         * fast path; this is what survives the tab.
         */
        if (file) void recordPendingWrite(file, yamlText);
        return error instanceof Error ? error : new Error(String(error));
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
   * The backoff is the floor, not the plan. A store that is answering again is
   * the direct signal that a refused write can go now, and waiting out a ladder
   * that has grown to a minute leaves work unsaved for no reason. Coming back
   * online or back to the tab count for the same reason.
   */
  private watchForRecovery() {
    if (typeof window === "undefined") return;

    const retryNow = () => void this.flushPending();
    window.addEventListener("online", retryNow);
    window.addEventListener("focus", retryNow);

    let wasAnswering = isStorageAnswering();
    const unsubscribe = subscribeStorageHealth(() => {
      const answering = isStorageAnswering();
      const recovered = answering && !wasAnswering;
      wasAnswering = answering;
      if (recovered) retryNow();
    });

    this.disposeRecovery = () => {
      window.removeEventListener("online", retryNow);
      window.removeEventListener("focus", retryNow);
      unsubscribe();
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
