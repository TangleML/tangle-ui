import { makeObservable, observable, runInAction } from "mobx";

import {
  getPipelineDocument,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import {
  assertRemotePipelineOwner,
  getRemotePipelineWriter,
  writeRemotePipelineDocument,
} from "@/services/remotePipelineEditorService";
import { normalizeBackendUrl } from "@/utils/backendIdentity";
import type { ComponentSpec } from "@/utils/componentSpec";
import { defaultPipelineWithName } from "@/utils/constants";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import {
  admitRemotePipelineWrite,
  assertRemotePipelineAvailable,
} from "./remotePipelineDeletion";
import {
  editorSpecFromRemoteTask,
  remotePipelineTaskFromSpec,
} from "./remotePipelineTask";
import {
  getEditorPipelineIdentity,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
} from "./types";

const pendingWrites = new Map<
  string,
  Promise<SavedPipelineDocument | undefined>
>();
const pathKey = (backendUrl: string, filePath: string) =>
  JSON.stringify([normalizeBackendUrl(backendUrl), "path", filePath]);

export async function waitForPendingPipelineWrites(
  ref: RemotePipelineRef,
  filePath?: string,
): Promise<void> {
  const keys = [
    getEditorPipelineIdentity(ref),
    ...(filePath ? [pathKey(ref.backendUrl, filePath)] : []),
  ];
  while (keys.some((key) => pendingWrites.has(key))) {
    await Promise.all(keys.map((key) => pendingWrites.get(key)));
  }
}

/** A document's remote identity and ordered writes, including its first save. */
export class PipelineFile {
  readonly initialId: string;
  readonly backendUrl: string;
  readonly filePath: string;
  readonly canEdit: boolean;
  @observable.ref accessor remote:
    Readonly<Omit<RemotePipelineRef, "source">> | undefined;
  @observable.ref private accessor document: SavedPipelineDocument | undefined;
  private readonly draft: RemotePipelineDraftRef | undefined;
  private notified = false;
  private savedSnapshot?: string;

  constructor(options: {
    ref: RemotePipelineDraftRef | RemotePipelineRef;
    document?: SavedPipelineDocument;
    canEdit?: boolean;
    filePath?: string;
    onCreated?: (remote: RemotePipelineRef) => Promise<unknown>;
    source?: SavedPipelineDocument;
  }) {
    this.initialId =
      options.ref.source === "draft"
        ? options.ref.draftId
        : options.ref.pipelineId;
    this.backendUrl = options.ref.backendUrl;
    this.filePath =
      options.document?.file_path ??
      options.filePath ??
      `pipelines/${crypto.randomUUID()}.yaml`;
    this.canEdit = options.canEdit ?? true;
    this.document = options.document;
    this.remote = options.document && {
      backendUrl: this.backendUrl,
      pipelineId: options.document.id,
    };
    this.draft = options.ref.source === "draft" ? options.ref : undefined;
    this.onCreated = options.onCreated;
    this.source = options.source;
    makeObservable(this);
  }

  private readonly onCreated?: (remote: RemotePipelineRef) => Promise<unknown>;
  private readonly source?: SavedPipelineDocument;

  static async open(ref: RemotePipelineRef): Promise<PipelineFile> {
    assertRemotePipelineAvailable(ref.backendUrl, ref);
    await waitForPendingPipelineWrites(ref);
    const [document, writer] = await Promise.all([
      getPipelineDocument(ref.pipelineId, ref.backendUrl),
      getRemotePipelineWriter(ref.backendUrl).catch(() => null),
    ]);
    assertRemotePipelineAvailable(ref.backendUrl, ref);
    return new PipelineFile({
      ref,
      document,
      canEdit: writer === document.user_id,
    });
  }

  static async create(
    backendUrl: string,
    name: string,
    spec: ComponentSpec,
    options: { filePath?: string; source?: SavedPipelineDocument } = {},
  ): Promise<PipelineFile> {
    const file = new PipelineFile({
      ref: { source: "draft", backendUrl, draftId: crypto.randomUUID(), name },
      ...options,
    });
    await file.write({ ...spec, name });
    return file;
  }

  get id(): string {
    return this.remote?.pipelineId ?? this.initialId;
  }
  get isDraft(): boolean {
    return !this.remote;
  }
  get ownerId(): string | undefined {
    return this.document?.user_id;
  }
  get name(): string {
    return (
      this.document?.root_pipeline_task.componentRef.spec.name ??
      this.draft?.name ??
      "Untitled pipeline"
    );
  }

  read(): ComponentSpec {
    return this.document
      ? editorSpecFromRemoteTask(this.document.root_pipeline_task)
      : defaultPipelineWithName(this.draft?.name ?? "Untitled pipeline", {
          provisionalName: this.draft?.provisionalName,
        });
  }

  async write(spec: ComponentSpec): Promise<void> {
    const admission = admitRemotePipelineWrite(
      this.backendUrl,
      this.remote ?? { filePath: this.filePath },
    );
    const key = pathKey(this.backendUrl, this.filePath);
    const keys = [
      key,
      ...(this.remote
        ? [getEditorPipelineIdentity({ source: "remote", ...this.remote })]
        : []),
    ];
    const snapshot = JSON.stringify(spec);
    const write = (
      pendingWrites.get(key) ?? Promise.resolve(this.document)
    ).then(async (current) => {
      admission.assertWritable();
      const previous = current ?? this.document;
      const writer = await getRemotePipelineWriter(this.backendUrl);
      if (previous) assertRemotePipelineOwner(previous, writer);
      admission.assertWritable();
      let created: Promise<unknown> | undefined;
      // Retrying a project attachment must not create another pipeline or version.
      if (!previous || this.notified || snapshot !== this.savedSnapshot) {
        const source = previous ?? this.source;
        const document = await writeRemotePipelineDocument(
          this.backendUrl,
          this.filePath,
          {
            root_pipeline_task: remotePipelineTaskFromSpec(
              spec,
              source?.root_pipeline_task,
            ),
            pipeline_run_annotations: source?.pipeline_run_annotations ?? {},
          },
        );
        if (
          previous &&
          (document.id !== previous.id || document.user_id !== previous.user_id)
        )
          throw new Error(
            "The backend returned a different pipeline after saving. Reload before editing again.",
          );
        assertRemotePipelineOwner(document, writer);
        runInAction(() => {
          this.document = document;
          this.remote = {
            backendUrl: this.backendUrl,
            pipelineId: document.id,
          };
          // Register the saved identity before observers follow the promoted file.
          if (!this.notified)
            created = this.onCreated?.({ source: "remote", ...this.remote });
        });
        this.savedSnapshot = snapshot;
        const remoteKey = getEditorPipelineIdentity({
          source: "remote",
          ...this.remote!,
        });
        if (!keys.includes(remoteKey)) keys.push(remoteKey);
        pendingWrites.set(remoteKey, pendingWrites.get(key) ?? settled);
      }
      if (!this.notified) {
        await (created ??
          this.onCreated?.({ source: "remote", ...this.remote! }));
        this.notified = true;
      }
      emitUserPipelineWritten();
      return this.document;
    });
    const settled = write.catch(() => this.document);
    for (const writeKey of keys) pendingWrites.set(writeKey, settled);
    return write
      .then(() => {})
      .finally(() => {
        for (const writeKey of keys)
          if (pendingWrites.get(writeKey) === settled)
            pendingWrites.delete(writeKey);
      });
  }

  async copy(name: string, spec: ComponentSpec): Promise<PipelineFile> {
    await pendingWrites.get(pathKey(this.backendUrl, this.filePath));
    return PipelineFile.create(this.backendUrl, name, spec, {
      source: this.document,
    });
  }
}
