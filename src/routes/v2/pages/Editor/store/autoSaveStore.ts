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
import { saveUndoHistory } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { AUTOSAVE_DEBOUNCE_TIME_MS } from "@/utils/constants";

import { type AutoSaveSnapshot, getAutoSaveSnapshot } from "./autoSaveSnapshot";
import type { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

const REMOTE_CONTENT_SAVE_DELAY_MS = 1000;
const REMOTE_MOVEMENT_SAVE_DELAY_MS = 3000;

interface SaveSession {
  spec: ComponentSpec;
  file: PipelineFile;
  pipelineName: string;
  savedYaml: string;
  queuedYaml: string;
  snapshot: AutoSaveSnapshot;
  pending: Promise<boolean>;
  saving: boolean;
  saveRequested: boolean;
  writingYaml?: string;
  contentDeadline?: number;
  movementDeadline?: number;
  timer?: ReturnType<typeof setTimeout>;
}

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor error: string | null = null;
  @observable accessor hasUnsavedChanges = false;

  private session: SaveSession | null = null;
  private disposeReaction: (() => void) | null = null;

  constructor(
    private undoStore: UndoStore,
    private pipelineFileStore: PipelineFileStore,
    private storage?: Pick<
      PipelineStorageService,
      "canMigrate" | "migratePipeline"
    >,
  ) {
    makeObservable(this);
  }

  @action init(spec: ComponentSpec, pipelineName: string) {
    this.dispose();
    const file = this.pipelineFileStore.activePipelineFile;
    if (!file?.canEdit) return;
    const snapshot = getAutoSaveSnapshot(spec);
    const session: SaveSession = {
      spec,
      file,
      pipelineName,
      savedYaml: snapshot.yaml,
      queuedYaml: snapshot.yaml,
      snapshot,
      pending: Promise.resolve(true),
      saving: false,
      saveRequested: false,
    };
    this.session = session;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.error = null;
    this.hasUnsavedChanges = false;
    this.disposeReaction = reaction(
      () => getAutoSaveSnapshot(spec),
      (next) => {
        if (next.yaml === session.snapshot.yaml) return;
        const contentChanged = next.contentKey !== session.snapshot.contentKey;
        session.snapshot = next;
        runInAction(() => {
          this.hasUnsavedChanges =
            next.yaml !== session.savedYaml ||
            (session.saving && next.yaml !== session.writingYaml);
        });
        void file.persistRecovery(next.yaml).catch((error: unknown) => {
          if (session !== this.session) return;
          runInAction(() => {
            this.error = error instanceof Error ? error.message : String(error);
            this.hasUnsavedChanges = true;
          });
        });
        if (
          next.yaml === session.savedYaml &&
          !session.saving &&
          !this.error &&
          !file.saveError
        ) {
          this.cancelScheduledSave(session);
          return;
        }
        const remote =
          file.storageKind !== "local" || this.storage?.canMigrate(file);
        if (!remote) {
          session.contentDeadline = Date.now() + AUTOSAVE_DEBOUNCE_TIME_MS;
        } else if (contentChanged) {
          session.contentDeadline = Date.now() + REMOTE_CONTENT_SAVE_DELAY_MS;
        } else {
          session.movementDeadline ??=
            Date.now() + REMOTE_MOVEMENT_SAVE_DELAY_MS;
        }
        this.scheduleSave(session);
      },
    );
  }

  private scheduleSave(session: SaveSession) {
    clearTimeout(session.timer);
    const deadline = Math.min(
      session.contentDeadline ?? Infinity,
      session.movementDeadline ?? Infinity,
    );
    session.timer = setTimeout(
      () => {
        void this.performSave(session);
      },
      Math.max(0, deadline - Date.now()),
    );
  }

  private cancelScheduledSave(session: SaveSession) {
    clearTimeout(session.timer);
    session.timer = undefined;
    session.contentDeadline = undefined;
    session.movementDeadline = undefined;
  }

  @action dispose(): Promise<boolean> {
    this.disposeReaction?.();
    this.disposeReaction = null;
    const session = this.session;
    if (session) {
      this.cancelScheduledSave(session);
      session.snapshot = getAutoSaveSnapshot(session.spec);
      if (session.snapshot.yaml !== session.queuedYaml)
        void this.performSave(session);
    }
    this.session = null;
    this.isSaving = false;
    return session?.pending ?? Promise.resolve(true);
  }

  async save(): Promise<boolean> {
    const session = this.session;
    if (!session) return false;
    this.cancelScheduledSave(session);
    session.snapshot = getAutoSaveSnapshot(session.spec);
    const content = session.snapshot.yaml;
    if (session.saving && content === session.queuedYaml)
      return session.pending;
    if (
      !session.saving &&
      content === session.savedYaml &&
      !this.error &&
      !session.file.saveError &&
      session.file.storageKind !== "pending" &&
      !this.storage?.canMigrate(session.file)
    )
      return true;
    return this.performSave(session);
  }

  private performSave(session: SaveSession): Promise<boolean> {
    this.cancelScheduledSave(session);
    session.queuedYaml = session.snapshot.yaml;
    session.saveRequested =
      !session.saving || session.snapshot.yaml !== session.writingYaml;
    if (session.saving) return session.pending;
    session.saving = true;
    if (session === this.session)
      runInAction(() => {
        this.isSaving = true;
      });
    session.pending = Promise.resolve().then(() => this.drainSaves(session));
    return session.pending;
  }

  private async drainSaves(session: SaveSession): Promise<boolean> {
    let saved = false;
    try {
      while (session.saveRequested) {
        session.saveRequested = false;
        this.cancelScheduledSave(session);
        const yamlText = session.snapshot.yaml;
        session.writingYaml = yamlText;
        session.queuedYaml = yamlText;
        try {
          await session.file.write(yamlText);
          if (session === this.session) await this.persistUndoHistory(session);
          if (this.storage?.canMigrate(session.file))
            await this.storage.migratePipeline(session.file);
          session.savedYaml = yamlText;
          if (session === this.session)
            runInAction(() => {
              this.error = null;
              this.lastSavedAt = new Date();
              this.hasUnsavedChanges =
                serializeComponentSpecToText(session.spec) !== yamlText;
            });
          saved = true;
        } catch (error) {
          if (session === this.session)
            runInAction(() => {
              this.error =
                error instanceof Error ? error.message : String(error);
              this.hasUnsavedChanges = true;
            });
          saved = false;
        }
      }
      return saved;
    } finally {
      session.saving = false;
      session.writingYaml = undefined;
      if (session === this.session)
        runInAction(() => {
          this.isSaving = false;
        });
    }
  }

  private async persistUndoHistory(session: SaveSession) {
    if (session.file.storageKind !== "local") return;
    const manager = this.undoStore.undoManager;
    if (!manager) return;
    try {
      await saveUndoHistory(
        session.pipelineName,
        collectIdStack(session.spec),
        manager,
      );
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }
}
