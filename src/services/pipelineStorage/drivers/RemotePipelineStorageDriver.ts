import {
  getPipelineDocument,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import {
  assertRemotePipelineOwner,
  getRemotePipelineWriter,
  writeRemotePipelineDocument,
} from "@/services/remotePipelineEditorService";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import {
  editorSpecFromRemoteTask,
  remotePipelineTaskFromSpec,
} from "../remotePipelineTask";
import {
  getEditorPipelineIdentity,
  type PipelineFileDescriptor,
  type PipelineStorageDriver,
  type RemotePipelineRef,
} from "../types";

// Writes survive editor navigation; reopening waits for the last write to this ID.
const pendingWrites = new Map<string, Promise<void>>();

/** One editor document, bound to its backend and stable server identity. */
export class RemotePipelineStorageDriver implements PipelineStorageDriver {
  readonly type = "remote-pipeline";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly backendUrl: string;
  readonly pipelineId: string;
  readonly filePath: string;
  readonly canEdit: boolean;
  private document: SavedPipelineDocument;
  private displayName: string;

  private constructor(
    backendUrl: string,
    document: SavedPipelineDocument,
    canEdit: boolean,
  ) {
    this.backendUrl = backendUrl;
    this.pipelineId = document.id;
    this.filePath = document.file_path;
    this.canEdit = canEdit;
    this.document = document;
    this.displayName =
      document.root_pipeline_task.componentRef.spec.name ??
      document.pipeline_name ??
      document.file_path;
  }

  static async open(
    ref: RemotePipelineRef,
  ): Promise<RemotePipelineStorageDriver> {
    const key = getEditorPipelineIdentity(ref);
    while (pendingWrites.has(key)) {
      await pendingWrites.get(key)?.catch(() => {});
    }
    const [document, userId] = await Promise.all([
      getPipelineDocument(ref.pipelineId, ref.backendUrl),
      // Failure to verify write access must not prevent reading the document.
      getRemotePipelineWriter(ref.backendUrl).catch(() => null),
    ]);
    return new RemotePipelineStorageDriver(
      ref.backendUrl,
      document,
      userId === document.user_id,
    );
  }

  static async create(
    backendUrl: string,
    name: string,
    content: string,
    filePath = `pipelines/${crypto.randomUUID()}.yaml`,
  ): Promise<RemotePipelineStorageDriver> {
    return this.createCopy({ backendUrl, name, content, filePath });
  }

  private static async createCopy({
    backendUrl,
    name,
    content,
    source,
    filePath = `pipelines/${crypto.randomUUID()}.yaml`,
  }: {
    backendUrl: string;
    name: string;
    content: string;
    source?: SavedPipelineDocument;
    filePath?: string;
  }): Promise<RemotePipelineStorageDriver> {
    const spec = { ...componentSpecFromYaml(content), name };
    const userId = await getRemotePipelineWriter(backendUrl);
    // Names are labels; a new random path prevents Save As replacing a namesake.
    const document = await writeRemotePipelineDocument(backendUrl, filePath, {
      root_pipeline_task: remotePipelineTaskFromSpec(
        spec,
        source?.root_pipeline_task,
      ),
      pipeline_run_annotations: source?.pipeline_run_annotations ?? {},
    });
    assertRemotePipelineOwner(document, userId);
    return new RemotePipelineStorageDriver(backendUrl, document, true);
  }

  async copy(
    name: string,
    content: string,
  ): Promise<RemotePipelineStorageDriver> {
    return RemotePipelineStorageDriver.createCopy({
      backendUrl: this.backendUrl,
      name,
      content,
      source: this.document,
    });
  }

  get name(): string {
    return this.displayName;
  }

  async list(): Promise<PipelineFileDescriptor[]> {
    return [{ storageKey: this.displayName }];
  }

  async read(_storageKey: string): Promise<string> {
    return componentSpecToYaml(
      editorSpecFromRemoteTask(this.document.root_pipeline_task),
    );
  }

  async write(_storageKey: string, content: string): Promise<void> {
    const spec = componentSpecFromYaml(content);
    const key = getEditorPipelineIdentity({ source: "remote", ...this });
    const write = (pendingWrites.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await this.assertCurrentOwner();
        const document = await writeRemotePipelineDocument(
          this.backendUrl,
          this.filePath,
          {
            root_pipeline_task: remotePipelineTaskFromSpec(
              spec,
              this.document.root_pipeline_task,
            ),
            pipeline_run_annotations: this.document.pipeline_run_annotations,
          },
        );
        this.assertSameDocument(document);
        this.document = document;
      });
    pendingWrites.set(key, write);
    try {
      await write;
    } finally {
      if (pendingWrites.get(key) === write) pendingWrites.delete(key);
    }
  }

  async rename(_oldStorageKey: string, newStorageKey: string): Promise<void> {
    await this.assertCurrentOwner();
    // The shared editor rename updates spec.name and persists through autosave.
    // The server file path remains the stable owner/path identity.
    this.displayName = newStorageKey;
  }

  async delete(_storageKey: string): Promise<void> {
    throw new Error("Pipeline deletion is not supported in this editor.");
  }

  async hasKey(storageKey: string): Promise<boolean> {
    return storageKey === this.displayName;
  }

  private async assertCurrentOwner(): Promise<void> {
    assertRemotePipelineOwner(
      this.document,
      await getRemotePipelineWriter(this.backendUrl),
    );
  }

  private assertSameDocument(document: SavedPipelineDocument): void {
    if (
      document.id !== this.pipelineId ||
      document.file_path !== this.filePath ||
      document.user_id !== this.document.user_id
    ) {
      throw new Error(
        "The backend returned a different pipeline after saving. Reload before editing again.",
      );
    }
  }
}
