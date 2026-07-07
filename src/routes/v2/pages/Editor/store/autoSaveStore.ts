import { action, makeObservable, observable, reaction } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  collectIdStack,
  serializeComponentSpecToText,
} from "@/models/componentSpec";
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";
import { debounce } from "@/utils/debounce";

import type { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

const AUTOSAVE_MIN_SAVING_INDICATOR_MS = 600;

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;

  private spec: ComponentSpec | null = null;
  private pipelineName: string | null = null;
  private disposeReaction: (() => void) | null = null;
  // Last content written to disk; used to skip a redundant flush on dispose.
  private lastSavedYaml: string | null = null;

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
    // The freshly-loaded spec matches what's on disk, so seed the baseline to
    // avoid flushing an unchanged pipeline on dispose.
    this.lastSavedYaml = this.serializeSpec();

    this.disposeReaction = reaction(
      () => this.serializeSpec(),
      (yamlText) => this.scheduleAutoSave(yamlText),
      { fireImmediately: false },
    );
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
  }

  private serializeSpec(): string | null {
    if (!this.spec) return null;
    try {
      return serializeComponentSpecToText(this.spec);
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
    const pipelineName = this.pipelineName;
    if (!pipelineName) return;

    this.setSaving(true);

    const savePromise = (async () => {
      try {
        await this.pipelineFileStore.activePipelineFile?.write(yamlText);
        await this.persistUndoHistory();
        this.lastSavedYaml = yamlText;
        return new Date();
      } catch (error) {
        console.error("Auto-save failed:", error);
        return null;
      }
    })();

    const minDisplayPromise = new Promise((resolve) =>
      setTimeout(resolve, AUTOSAVE_MIN_SAVING_INDICATOR_MS),
    );

    const [savedAt] = await Promise.all([savePromise, minDisplayPromise]);

    if (savedAt) {
      this.setSaved(savedAt);
    } else {
      this.setSaving(false);
    }
  }

  private async persistUndoHistory() {
    if (!this.spec || !this.pipelineName) return;
    const manager = this.undoStore.undoManager;
    if (!manager) return;

    try {
      const idStack = collectIdStack(this.spec);
      await saveUndoHistory(this.pipelineName, idStack, manager);
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }
}
