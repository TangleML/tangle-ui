import { action, makeObservable, observable, reaction } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { JsonSerializer } from "@/models/componentSpec";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  AUTOSAVE_DEBOUNCE_TIME_MS,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";
import { componentSpecToText } from "@/utils/yaml";

const SAVED_MESSAGE_DURATION_MS = 2000;
const MIN_SAVING_DISPLAY_MS = 1000;

class AutoSaveStore {
  isSaving = false;
  lastSavedAt: Date | null = null;
  showSavedMessage = false;

  private spec: ComponentSpec | null = null;
  private pipelineName: string | null = null;
  private serializer = new JsonSerializer();
  private disposeReaction: (() => void) | null = null;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private savedMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeObservable(this, {
      isSaving: observable,
      lastSavedAt: observable,
      showSavedMessage: observable,
      init: action,
      dispose: action,
      setSaving: action,
      setSaved: action,
      setShowSavedMessage: action,
    });
  }

  init(spec: ComponentSpec, pipelineName: string) {
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

  dispose() {
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

  setSaving(value: boolean) {
    this.isSaving = value;
  }

  setSaved(date: Date) {
    this.lastSavedAt = date;
    this.isSaving = false;
  }

  setShowSavedMessage(value: boolean) {
    this.showSavedMessage = value;
  }

  private serializeSpec(): string | null {
    if (!this.spec) return null;
    try {
      return componentSpecToText(
        this.serializer.serialize(this.spec) as Parameters<
          typeof componentSpecToText
        >[0],
      );
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
    if (!this.pipelineName) return;

    this.setSaving(true);

    const savePromise = (async () => {
      try {
        await writeComponentToFileListFromText(
          USER_PIPELINES_LIST_NAME,
          this.pipelineName!,
          yamlText,
        );
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
