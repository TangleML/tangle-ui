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
import { debounce } from "@/utils/debounce";

import type { PipelineFileStore } from "./pipelineFileStore";
import type { UndoStore } from "./undoStore";

interface SaveSession {
  spec: ComponentSpec;
  file: PipelineFile;
  savedYaml: string;
  queuedYaml: string;
  hasPendingRecovery: boolean;
  pending: Promise<boolean>;
  pendingCount: number;
}

interface AutoSaveInitOptions {
  savedYaml?: string;
  forceSave?: boolean;
}

export class AutoSaveStore {
  @observable accessor isSaving = false;
  @observable accessor lastSavedAt: Date | null = null;
  @observable accessor error: string | null = null;
  @observable accessor hasUnsavedChanges = false;

  private session: SaveSession | null = null;
  private disposeReaction: (() => void) | null = null;
  private debouncedSave = debounce((session: SaveSession, yamlText: string) => {
    void this.performSave(session, yamlText);
  }, AUTOSAVE_DEBOUNCE_TIME_MS);

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

  @action init(spec: ComponentSpec, options: AutoSaveInitOptions = {}) {
    this.dispose();
    const file = this.pipelineFileStore.activePipelineFile;
    if (!file?.canEdit) return;
    const yamlText = serializeComponentSpecToText(spec);
    const savedYaml = options.savedYaml ?? yamlText;
    const needsSave = options.forceSave || yamlText !== savedYaml;
    const session: SaveSession = {
      spec,
      file,
      savedYaml,
      queuedYaml: savedYaml,
      hasPendingRecovery: options.forceSave ?? false,
      pending: Promise.resolve(true),
      pendingCount: 0,
    };
    this.session = session;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.error = null;
    this.hasUnsavedChanges = needsSave;
    this.disposeReaction = reaction(
      () => serializeComponentSpecToText(spec),
      (content) => {
        session.hasPendingRecovery ||= file.storageKind !== "local";
        runInAction(() => {
          this.hasUnsavedChanges =
            content !== session.savedYaml || session.hasPendingRecovery;
        });
        void file.persistRecovery(content).catch((error: unknown) => {
          if (session !== this.session) return;
          runInAction(() => {
            this.error = error instanceof Error ? error.message : String(error);
            this.hasUnsavedChanges = true;
          });
        });
        if (
          content === session.savedYaml &&
          session.pendingCount === 0 &&
          !session.hasPendingRecovery &&
          !this.error &&
          !file.saveError
        ) {
          this.debouncedSave.cancel();
          return;
        }
        this.debouncedSave(session, content);
      },
    );
    if (needsSave) {
      session.hasPendingRecovery ||= file.storageKind !== "local";
      void file.persistRecovery(yamlText).catch((error: unknown) => {
        if (session !== this.session) return;
        runInAction(() => {
          this.error = error instanceof Error ? error.message : String(error);
          this.hasUnsavedChanges = true;
        });
      });
      this.debouncedSave(session, yamlText);
    }
  }

  @action dispose(): Promise<boolean> {
    this.debouncedSave.cancel();
    this.disposeReaction?.();
    this.disposeReaction = null;
    const session = this.session;
    if (session) {
      const content = serializeComponentSpecToText(session.spec);
      if (content !== session.queuedYaml || session.hasPendingRecovery)
        void this.performSave(session, content);
    }
    this.session = null;
    this.isSaving = false;
    return session?.pending ?? Promise.resolve(true);
  }

  async save(): Promise<boolean> {
    this.debouncedSave.cancel();
    const session = this.session;
    if (!session) return false;
    const content = serializeComponentSpecToText(session.spec);
    if (
      session.pendingCount > 0 &&
      content === session.queuedYaml &&
      !session.hasPendingRecovery
    )
      return session.pending;
    if (
      content === session.savedYaml &&
      !session.hasPendingRecovery &&
      !this.error &&
      !session.file.saveError &&
      session.file.storageKind !== "pending" &&
      !this.storage?.canMigrate(session.file)
    )
      return true;
    return this.performSave(session, content);
  }

  private performSave(
    session: SaveSession,
    yamlText: string,
  ): Promise<boolean> {
    session.queuedYaml = yamlText;
    // Even reverted edits stage dirty recovery; only a queued flush can clear it.
    session.hasPendingRecovery = false;
    session.pendingCount++;
    if (session === this.session)
      runInAction(() => {
        this.isSaving = true;
      });
    const previousWrite =
      session.file.storageKind === "local"
        ? session.pending
        : Promise.resolve(true);
    session.pending = previousWrite.then(async () => {
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
              serializeComponentSpecToText(session.spec) !== yamlText ||
              session.hasPendingRecovery;
          });
        return true;
      } catch (error) {
        if (session === this.session)
          runInAction(() => {
            this.error = error instanceof Error ? error.message : String(error);
            this.hasUnsavedChanges = true;
          });
        return false;
      } finally {
        session.pendingCount--;
        if (session === this.session)
          runInAction(() => {
            this.isSaving = session.pendingCount > 0;
          });
      }
    });
    return session.pending;
  }

  private async persistUndoHistory(session: SaveSession) {
    if (session.file.storageKind !== "local") return;
    const manager = this.undoStore.undoManager;
    if (!manager) return;
    try {
      await saveUndoHistory(
        session.file.referenceId,
        collectIdStack(session.spec),
        manager,
      );
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }
}
