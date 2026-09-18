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
  pipelineName: string;
  savedYaml: string;
  queuedYaml: string;
  pending: Promise<boolean>;
  pendingCount: number;
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

  @action init(spec: ComponentSpec, pipelineName: string) {
    this.dispose();
    const file = this.pipelineFileStore.activePipelineFile;
    if (!file?.canEdit) return;
    const yamlText = serializeComponentSpecToText(spec);
    const session: SaveSession = {
      spec,
      file,
      pipelineName,
      savedYaml: yamlText,
      queuedYaml: yamlText,
      pending: Promise.resolve(true),
      pendingCount: 0,
    };
    this.session = session;
    this.isSaving = false;
    this.lastSavedAt = null;
    this.error = null;
    this.hasUnsavedChanges = false;
    this.disposeReaction = reaction(
      () => serializeComponentSpecToText(spec),
      (content) => {
        runInAction(() => {
          this.hasUnsavedChanges = content !== session.savedYaml;
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
          !this.error &&
          !file.saveError
        ) {
          this.debouncedSave.cancel();
          return;
        }
        this.debouncedSave(session, content);
      },
    );
  }

  @action dispose(): Promise<boolean> {
    this.debouncedSave.cancel();
    this.disposeReaction?.();
    this.disposeReaction = null;
    const session = this.session;
    if (session) {
      const content = serializeComponentSpecToText(session.spec);
      if (content !== session.queuedYaml)
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
    if (session.pendingCount > 0 && content === session.queuedYaml)
      return session.pending;
    if (
      content === session.savedYaml &&
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
              serializeComponentSpecToText(session.spec) !== yamlText;
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
        session.pipelineName,
        collectIdStack(session.spec),
        manager,
      );
    } catch (error) {
      console.error("Failed to persist undo history:", error);
    }
  }
}
