import { action, makeObservable, observable, reaction } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { collectIdStack, JsonSerializer } from "@/models/componentSpec";
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { writeToFileHandle } from "@/services/fileHandleRegistry";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  AUTOSAVE_DEBOUNCE_TIME_MS,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { componentSpecToText } from "@/utils/yaml";

import { undoStore } from "./undoStore";

const SAVED_MESSAGE_DURATION_MS = 2000;
const MIN_SAVING_DISPLAY_MS = 1000;

class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor showSavedMessage = false;

  private spec: ComponentSpec | null = null;
  private pipelineName: string | null = null;
  private serializer = new JsonSerializer();
  private disposeReaction: (() => void) | null = null;
  // todo: replace with debounce() helper
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private savedMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, pipelineName: string) {
    this.dispose();
    this.spec = spec;
    this.pipelineName = pipelineName;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.showSavedMessage = false;

    this.disposeReaction = reaction(
      () => this.serializeSpec(),
      (yamlText) => this.scheduleAutoSave(yamlText),
      { fireImmediately: false },
    );
  }

  @action dispose() {
    this.disposeReaction?.();
    this.disposeReaction = null;
    this.clearDebounce();
    this.clearSavedMessageTimeout();
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
  }

  @action setShowSavedMessage(value: boolean) {
    this.showSavedMessage = value;
  }

  private serializeSpec(): string | null {
    if (!this.spec) return null;
    try {
      return componentSpecToText(this.serializer.serialize(this.spec));
    } catch {
      return null;
    }
  }

  private scheduleAutoSave(yamlText: string | null) {
    this.clearDebounce();
    if (!yamlText || !this.pipelineName) return;

    this.debounceTimeout = setTimeout(() => {
      void this.performSave(yamlText);
    }, AUTOSAVE_DEBOUNCE_TIME_MS);
  }

  private async performSave(yamlText: string) {
    const pipelineName = this.pipelineName;
    if (!pipelineName) return;

    this.setSaving(true);

    const savePromise = (async () => {
      try {
        /**
         * Create a persistence layer for the pipeline, so we can add more storage drivers (google disk, backend api, etc.)
         */
        await writeComponentToFileListFromText(
          USER_PIPELINES_LIST_NAME,
          pipelineName,
          yamlText,
        );
        await writeToFileHandle(pipelineName, yamlText).catch((err) =>
          console.warn("File system write-back failed:", err),
        );
        await this.persistUndoHistory();
        this.setSaved(new Date());
        this.flashSavedMessage();
      } catch (error) {
        console.error("Auto-save failed:", error);
        this.setSaving(false);
      }
    })();

    const minDisplayPromise = new Promise((resolve) =>
      setTimeout(resolve, MIN_SAVING_DISPLAY_MS),
    );

    await Promise.all([savePromise, minDisplayPromise]);
  }

  private async persistUndoHistory() {
    if (!this.spec || !this.pipelineName) return;
    const manager = undoStore.undoManager;
    if (!manager) return;

    try {
      const idStack = collectIdStack(this.spec);
      await saveUndoHistory(this.pipelineName, idStack, manager);
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }

  private flashSavedMessage() {
    this.clearSavedMessageTimeout();
    this.setShowSavedMessage(true);
    this.savedMessageTimeout = setTimeout(() => {
      this.setShowSavedMessage(false);
    }, SAVED_MESSAGE_DURATION_MS);
  }

  private clearDebounce() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }

  private clearSavedMessageTimeout() {
    if (this.savedMessageTimeout) {
      clearTimeout(this.savedMessageTimeout);
      this.savedMessageTimeout = null;
    }
  }
}

export const autoSaveStore = new AutoSaveStore();
