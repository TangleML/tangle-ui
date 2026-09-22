import yaml from "js-yaml";
import { observable, runInAction } from "mobx";

import {
  type CloudConnection,
  type CloudPipelineAccount,
  type CloudPipelineSummary,
  cloudPipelineToComponentSpec,
  deleteCloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { getErrorMessage } from "@/utils/string";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

import { migratePipelineReferences } from "./migratePipelineReferences";
import type { PipelineFile } from "./PipelineFile";
import type { PipelineFolder } from "./PipelineFolder";
import { withPipelineLock } from "./pipelineLock";
import { RemotePipelineFile } from "./RemotePipelineFile";
import {
  parseRemotePipelineReference,
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";

export interface RemotePipelineOptions {
  connection: CloudConnection;
  scope: string;
}

export class RemotePipelineStore {
  @observable.ref accessor account: CloudPipelineAccount | undefined;
  @observable accessor listError: string | undefined;
  private accountRequest?: Promise<CloudPipelineAccount>;

  constructor(
    readonly options: RemotePipelineOptions,
    readonly folder: PipelineFolder,
  ) {}

  get backendUrl(): string {
    return this.options.connection.backendUrl.replace(/\/+$/, "");
  }
  get scope(): string {
    return this.options.scope;
  }

  private async connection(): Promise<CloudConnection> {
    if (!this.backendUrl)
      throw new Error("Configure a backend before saving remote pipelines.");
    if (!this.accountRequest) {
      this.accountRequest = getCloudPipelineAccount(this.options.connection)
        .then((account) => {
          runInAction(() => {
            this.account = account;
          });
          return account;
        })
        .catch((error) => {
          this.accountRequest = undefined;
          throw error;
        });
    }
    return { ...this.options.connection, account: await this.accountRequest };
  }

  private recoveryKey(filePath: string): string {
    return `pending:${encodeURIComponent(this.scope)}:${encodeURIComponent(filePath)}`;
  }

  async records(): Promise<RemotePipelineRecovery[]> {
    return remotePipelineRecoveryDb.copies
      .where("scope")
      .equals(this.scope)
      .toArray();
  }

  async list(): Promise<RemotePipelineFile[]> {
    const records = await this.records();
    const result = new Map(
      records
        .filter(
          (record) =>
            !record.deleted && (!record.localFileId || record.migrated),
        )
        .map((record) => [
          record.filePath,
          new RemotePipelineFile(this, this.folder, record),
        ]),
    );
    try {
      const connection = await this.connection();
      const summaries = await listCloudPipelines(connection);
      for (const summary of summaries) {
        if (summary.user_id !== connection.account?.id) continue;
        const record = records.find(
          (item) => item.filePath === summary.file_path,
        );
        if (record?.localFileId && !record.migrated) continue;
        result.set(summary.file_path, this.fromSummary(summary, record));
      }
      // Clean recovery copies are not a second remote catalog after server-side deletion.
      const remotePaths = new Set(
        summaries.map((summary) => summary.file_path),
      );
      for (const [path, file] of result) {
        if (
          file.recovery.pipeline &&
          !file.recovery.dirty &&
          !remotePaths.has(path)
        )
          result.delete(path);
      }
      runInAction(() => {
        this.listError = undefined;
      });
    } catch (error) {
      runInAction(() => {
        this.listError = getErrorMessage(error);
      });
    }
    return [...result.values()];
  }

  private fromSummary(
    summary: CloudPipelineSummary,
    record?: RemotePipelineRecovery,
  ): RemotePipelineFile {
    if (record && !record.dirty)
      record = {
        ...record,
        displayName: summary.pipeline_name ?? summary.file_path,
        modifiedAt: new Date(summary.updated_at).getTime(),
      };
    return new RemotePipelineFile(
      this,
      this.folder,
      record ?? {
        key: this.recoveryKey(summary.file_path),
        scope: this.scope,
        filePath: summary.file_path,
        displayName: summary.pipeline_name ?? summary.file_path,
        content: "",
        dirty: false,
        modifiedAt: new Date(summary.updated_at).getTime(),
      },
      summary,
    );
  }

  async resolve(reference: string): Promise<RemotePipelineFile | undefined> {
    if (reference.startsWith("pending:")) {
      const record = await remotePipelineRecoveryDb.copies.get(reference);
      if (!record || record.scope !== this.scope)
        throw new Error(
          "This pending pipeline belongs to another account or backend.",
        );
      if (record.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      await this.connection().catch(() => undefined);
      return new RemotePipelineFile(this, this.folder, record);
    }
    const parsed = parseRemotePipelineReference(reference);
    if (!parsed) return undefined;
    if (parsed.backendUrl !== this.backendUrl)
      throw new Error("This pipeline belongs to a different backend.");
    let pipeline;
    try {
      pipeline = await getCloudPipeline(
        parsed.pipelineId,
        await this.connection(),
      );
    } catch (error) {
      const cached = (await this.records()).find(
        (record) =>
          record.pipeline?.id === parsed.pipelineId && !record.deleted,
      );
      if (!cached?.dirty) throw error;
      return new RemotePipelineFile(this, this.folder, cached);
    }
    const record = await remotePipelineRecoveryDb.copies.get(
      this.recoveryKey(pipeline.file_path),
    );
    // Other owners can use the same file path; never attach our draft to their pipeline.
    const ownRecord = record?.pipeline?.id === pipeline.id ? record : undefined;
    return this.fromSummary(
      pipeline,
      ownRecord
        ? { ...ownRecord, pipeline }
        : {
            key: this.recoveryKey(pipeline.file_path),
            scope: this.scope,
            filePath: pipeline.file_path,
            displayName: pipeline.pipeline_name ?? pipeline.file_path,
            content: yaml.dump(cloudPipelineToComponentSpec(pipeline)),
            dirty: false,
            modifiedAt: new Date(pipeline.updated_at).getTime(),
            pipeline,
            ownerId:
              pipeline.user_id === this.account?.id &&
              this.account.permissions.includes("write")
                ? this.account.id
                : undefined,
          },
    );
  }

  async resolveLocal(fileId: string): Promise<RemotePipelineFile | undefined> {
    const record = await remotePipelineRecoveryDb.copies
      .where("[scope+localFileId]")
      .equals([this.scope, fileId])
      .first();
    if (!record?.migrated) return undefined;
    if (record.deleted)
      throw new Error("This pipeline has been deleted from the server.");
    await this.connection().catch(() => undefined);
    return new RemotePipelineFile(this, this.folder, record);
  }

  async create(
    name: string,
    content: string,
    source?: PipelineFile,
  ): Promise<RemotePipelineFile> {
    if (!this.backendUrl)
      throw new Error("Configure a backend before creating a remote pipeline.");
    const cloneSource = source?.redirectedFile ?? source;
    const filePath = `pipeline-studio/${crypto.randomUUID()}.yaml`;
    const record: RemotePipelineRecovery = {
      key: this.recoveryKey(filePath),
      scope: this.scope,
      filePath,
      displayName: name,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      cloneSource:
        cloneSource instanceof RemotePipelineFile
          ? cloneSource.recovery.pipeline
          : undefined,
    };
    const file = new RemotePipelineFile(this, this.folder, record);
    await file.persistRecovery(content);
    await file.retry().catch(() => undefined);
    emitUserPipelineWritten();
    return file;
  }

  async migrate(file: PipelineFile): Promise<RemotePipelineFile> {
    return withPipelineLock(file.id, async () => {
      const existing = await this.resolveLocal(file.id);
      if (existing) return existing;
      const content = await file.read();
      const initial = this.localRecovery(file, content);
      // A newer edit can be staged while the local read is in flight.
      const record = await remotePipelineRecoveryDb.transaction(
        "rw",
        remotePipelineRecoveryDb.copies,
        async () => {
          const previous = await remotePipelineRecoveryDb.copies.get(
            initial.key,
          );
          const record = previous
            ? {
                ...previous,
                displayName: file.displayName,
                localStorageKey: file.storageKey,
              }
            : initial;
          await remotePipelineRecoveryDb.copies.put(record);
          return record;
        },
      );
      const remote = new RemotePipelineFile(this, this.folder, record);
      await remote.retry();
      runInAction(() => {
        file.redirectedFile = remote;
      });
      return remote;
    });
  }

  private localRecovery(
    file: PipelineFile,
    content: string,
  ): RemotePipelineRecovery {
    const filePath = `pipeline-studio/${file.id}.yaml`;
    return {
      key: this.recoveryKey(filePath),
      scope: this.scope,
      filePath,
      displayName: file.displayName,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      localFileId: file.id,
      localStorageKey: file.storageKey,
    };
  }

  async stageLocal(file: PipelineFile, content: string): Promise<void> {
    await this.stageRecord(this.localRecovery(file, content), content);
  }

  async readLocalRecovery(file: PipelineFile): Promise<string | undefined> {
    const record = await remotePipelineRecoveryDb.copies.get(
      this.recoveryKey(`pipeline-studio/${file.id}.yaml`),
    );
    if (record?.deleted)
      throw new Error("This pipeline has been deleted from the server.");
    return record?.dirty ? record.content : undefined;
  }

  async read(file: RemotePipelineFile): Promise<string> {
    return withPipelineLock(file.recovery.key, async () => {
      const persisted = await remotePipelineRecoveryDb.copies.get(
        file.recovery.key,
      );
      if (
        persisted &&
        persisted.pipeline?.id ===
          (file.recovery.pipeline ?? file.summary)?.id &&
        file.canEdit
      )
        file.setRecovery(persisted);
      if (file.recovery.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      if (file.recovery.dirty) return file.recovery.content;
      const pipelineId = (file.recovery.pipeline ?? file.summary)?.id;
      if (!pipelineId) return file.recovery.content;
      const snapshot = file.recovery;
      const pipeline = await getCloudPipeline(
        pipelineId,
        await this.connection(),
      );
      let record: RemotePipelineRecovery = {
        ...snapshot,
        pipeline,
        displayName: pipeline.pipeline_name ?? pipeline.file_path,
        content: yaml.dump(cloudPipelineToComponentSpec(pipeline)),
        modifiedAt: new Date(pipeline.updated_at).getTime(),
      };
      if (pipeline.user_id === this.account?.id)
        record = await this.mergeCompletion(record);
      file.setRecovery(record);
      return record.content;
    });
  }

  async flush(file: RemotePipelineFile): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can change this remote pipeline.");
    await withPipelineLock(file.recovery.key, async () => {
      let record =
        (await remotePipelineRecoveryDb.copies.get(file.recovery.key)) ??
        file.recovery;
      if (record.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      if (!record.dirty) {
        file.setRecovery(record);
        return;
      }
      try {
        const connection = await this.connection();
        const spec = yaml.load(record.content, PIPELINE_YAML_LOAD_OPTIONS);
        if (!isValidComponentSpec(spec))
          throw new Error("The pipeline is not a valid component definition.");
        const pipeline = await writeCloudPipeline(
          {
            filePath: record.filePath,
            componentSpec: spec,
            existingPipeline: record.pipeline,
            sourcePipeline: record.cloneSource,
          },
          connection,
        );
        const referenceId = remotePipelineReference(
          this.backendUrl,
          pipeline.id,
        );
        record = {
          ...record,
          pipeline,
          cloneSource: undefined,
          dirty: false,
          error: undefined,
          displayName:
            pipeline.pipeline_name ?? spec.name ?? record.displayName,
          ownerId: pipeline.user_id,
        };
        // Persist the confirmed ID before reference migration so retry never creates a new remote.
        record = await this.mergeCompletion(record);
        if (!record.migrated) {
          await migratePipelineReferences(
            record.localStorageKey ?? record.key,
            referenceId,
            record.displayName,
          );
          record = await this.mergeCompletion({ ...record, migrated: true });
        }
        file.setRecovery(record);
      } catch (error) {
        const failed = await this.mergeCompletion({
          ...record,
          dirty: true,
          error: getErrorMessage(error),
        });
        file.setRecovery(failed);
        throw error;
      }
    });
  }

  async stage(file: RemotePipelineFile, content: string): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can change this remote pipeline.");
    file.setRecovery(await this.stageRecord(file.recovery, content));
  }

  private async stageRecord(
    recovery: RemotePipelineRecovery,
    content: string,
  ): Promise<RemotePipelineRecovery> {
    return remotePipelineRecoveryDb.transaction(
      "rw",
      remotePipelineRecoveryDb.copies,
      async () => {
        const previous =
          (await remotePipelineRecoveryDb.copies.get(recovery.key)) ?? recovery;
        if (previous.deleted)
          throw new Error("This pipeline has been deleted from the server.");
        const next: RemotePipelineRecovery = {
          ...previous,
          content,
          dirty: true,
          modifiedAt: Date.now(),
          revision: (previous.revision ?? 0) + 1,
        };
        await remotePipelineRecoveryDb.copies.put(next);
        return next;
      },
    );
  }

  private async mergeCompletion(
    completed: RemotePipelineRecovery,
  ): Promise<RemotePipelineRecovery> {
    return remotePipelineRecoveryDb.transaction(
      "rw",
      remotePipelineRecoveryDb.copies,
      async () => {
        const latest = await remotePipelineRecoveryDb.copies.get(completed.key);
        const record =
          latest && latest.revision !== completed.revision
            ? {
                ...completed,
                content: latest.content,
                revision: latest.revision,
                modifiedAt: latest.modifiedAt,
                dirty: true,
              }
            : completed;
        await remotePipelineRecoveryDb.copies.put(record);
        return record;
      },
    );
  }

  async delete(file: RemotePipelineFile): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can delete this remote pipeline.");
    await withPipelineLock(file.recovery.key, async () => {
      const record =
        (await remotePipelineRecoveryDb.copies.get(file.recovery.key)) ??
        file.recovery;
      const pipeline = record.pipeline ?? file.summary;
      if (pipeline)
        await deleteCloudPipeline(pipeline, await this.connection());
      // Retain the hidden migration marker and original backup after deleting its remote entry.
      if (record.localFileId) {
        await remotePipelineRecoveryDb.copies.put({
          ...record,
          deleted: true,
          dirty: false,
          error: undefined,
        });
      } else {
        await remotePipelineRecoveryDb.copies.delete(file.recovery.key);
      }
      emitUserPipelineWritten();
    });
  }
}
