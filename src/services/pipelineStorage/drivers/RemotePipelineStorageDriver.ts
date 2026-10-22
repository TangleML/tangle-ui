import {
  getPipelineDocument,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import {
  assertRemotePipelineOwner,
  getRemotePipelineWriter,
  writeRemotePipelineDocument,
} from "@/services/remotePipelineEditorService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import {
  admitRemotePipelineWrite,
  assertRemotePipelineAvailable,
  type RemotePipelineWriteAdmission,
} from "../remotePipelineDeletion";
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
const pendingWrites = new Map<string, Promise<SavedPipelineDocument>>();
const pendingCreations = new Map<string, Set<Promise<void>>>();

export async function waitForPendingRemotePipelineWrites(
  ref: RemotePipelineRef,
  filePath?: string,
): Promise<void> {
  const key = getEditorPipelineIdentity(ref);
  const pathKey = JSON.stringify([ref.backendUrl, filePath]);
  while (pendingWrites.has(key) || pendingCreations.has(pathKey)) {
    await Promise.all([
      pendingWrites.get(key),
      ...(pendingCreations.get(pathKey) ?? []),
    ]);
  }
}

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
    assertRemotePipelineAvailable(ref.backendUrl, ref);
    await waitForPendingRemotePipelineWrites(ref);
    const [document, userId] = await Promise.all([
      getPipelineDocument(ref.pipelineId, ref.backendUrl),
      // Failure to verify write access must not prevent reading the document.
      getRemotePipelineWriter(ref.backendUrl).catch(() => null),
    ]);
    assertRemotePipelineAvailable(ref.backendUrl, ref);
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
    admission = admitRemotePipelineWrite(backendUrl, { filePath }),
  ): Promise<RemotePipelineStorageDriver> {
    return this.createCopy({ backendUrl, name, content, filePath, admission });
  }

  private static async createCopy({
    backendUrl,
    name,
    content,
    source,
    filePath = `pipelines/${crypto.randomUUID()}.yaml`,
    admission = admitRemotePipelineWrite(backendUrl, { filePath }),
  }: {
    backendUrl: string;
    name: string;
    content: string;
    source?: SavedPipelineDocument;
    filePath?: string;
    admission?: RemotePipelineWriteAdmission;
  }): Promise<RemotePipelineStorageDriver> {
    admission.assertWritable();
    const spec = { ...componentSpecFromYaml(content), name };
    const creation = Promise.resolve().then(async () => {
      const userId = await getRemotePipelineWriter(backendUrl);
      admission.assertWritable();
      const document = await writeRemotePipelineDocument(backendUrl, filePath, {
        root_pipeline_task: remotePipelineTaskFromSpec(
          spec,
          source?.root_pipeline_task,
        ),
        pipeline_run_annotations: source?.pipeline_run_annotations ?? {},
      });
      assertRemotePipelineOwner(document, userId);
      return new RemotePipelineStorageDriver(backendUrl, document, true);
    });
    const pathKey = JSON.stringify([backendUrl, filePath]);
    const pending = pendingCreations.get(pathKey) ?? new Set<Promise<void>>();
    const settled = creation.then(
      () => {},
      () => {},
    );
    pending.add(settled);
    pendingCreations.set(pathKey, pending);
    try {
      return await creation;
    } finally {
      pending.delete(settled);
      if (!pending.size) pendingCreations.delete(pathKey);
    }
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

  get ownerId(): string {
    return this.document.user_id;
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

  async write(
    _storageKey: string,
    content: string,
    admission?: RemotePipelineWriteAdmission,
  ): Promise<void> {
    const spec = componentSpecFromYaml(content);
    await this.updateSpec(() => spec, admission);
  }

  async rename(
    _oldStorageKey: string,
    newStorageKey: string,
    admission?: RemotePipelineWriteAdmission,
  ): Promise<void> {
    await this.updateSpec((document) => {
      const spec = editorSpecFromRemoteTask(document.root_pipeline_task);
      return spec.name === newStorageKey
        ? undefined
        : { ...spec, name: newStorageKey };
    }, admission);
    this.displayName = newStorageKey;
  }

  async delete(_storageKey: string): Promise<void> {
    throw new Error("Pipeline deletion is not supported in this editor.");
  }

  async hasKey(storageKey: string): Promise<boolean> {
    return storageKey === this.displayName;
  }

  private async updateSpec(
    getSpec: (document: SavedPipelineDocument) => ComponentSpec | undefined,
    admission = admitRemotePipelineWrite(this.backendUrl, this),
  ): Promise<void> {
    admission.assertWritable();
    const key = getEditorPipelineIdentity({ source: "remote", ...this });
    const write = (
      pendingWrites.get(key) ?? Promise.resolve(this.document)
    ).then(async (current) => {
      this.document = current;
      await this.assertCurrentOwner();
      admission.assertWritable();
      const spec = getSpec(current);
      if (!spec) return current;
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
      return document;
    });
    const settled = write.catch(() => this.document);
    pendingWrites.set(key, settled);
    try {
      await write;
    } finally {
      if (pendingWrites.get(key) === settled) pendingWrites.delete(key);
    }
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
