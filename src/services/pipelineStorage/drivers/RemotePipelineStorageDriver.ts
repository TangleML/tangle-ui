import yaml from "js-yaml";
import { observable, runInAction } from "mobx";

import {
  type CloudConnection,
  type CloudPipeline,
  type CloudPipelineAccount,
  type CloudPipelineSummary,
  cloudPipelineToComponentSpec,
  deleteCloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

import {
  parseRemotePipelineReference,
  remotePipelineReference,
} from "../remotePipelineRecovery";
import type {
  PipelineFileDescriptor,
  PipelinePageOptions,
  PipelineReadResult,
  PipelineStorageDriver,
  PipelineStoragePage,
  PipelineWriteOptions,
} from "../types";

interface RemotePipelineDescriptor<
  T extends CloudPipelineSummary = CloudPipelineSummary,
> extends PipelineFileDescriptor {
  pipeline: T;
}

export class RemotePipelineStorageDriver implements PipelineStorageDriver<RemotePipelineDescriptor> {
  readonly type = "remote";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  @observable.ref accessor account: CloudPipelineAccount | undefined;
  private accountRequest?: Promise<CloudPipelineAccount>;

  constructor(private readonly options: CloudConnection) {}

  get backendUrl(): string {
    return this.options.backendUrl.replace(/\/+$/, "");
  }

  async connect(): Promise<CloudConnection> {
    if (!this.backendUrl)
      throw new Error("Configure a backend before saving remote pipelines.");
    if (!this.accountRequest) {
      this.accountRequest = getCloudPipelineAccount(this.options)
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
    return { ...this.options, account: await this.accountRequest };
  }

  describe<T extends CloudPipelineSummary>(
    pipeline: T,
  ): RemotePipelineDescriptor<T> {
    const reference = remotePipelineReference(this.backendUrl, pipeline.id);
    return {
      id: reference,
      storageKey: reference,
      displayName: pipeline.pipeline_name ?? pipeline.file_path,
      canEdit:
        this.account?.id === pipeline.user_id &&
        this.account.permissions.includes("write"),
      createdAt: new Date(pipeline.created_at),
      modifiedAt: new Date(pipeline.updated_at),
      pipeline,
    };
  }

  async list(): Promise<RemotePipelineDescriptor[]> {
    const connection = await this.connect();
    return (await listCloudPipelines(connection)).map((pipeline) =>
      this.describe(pipeline),
    );
  }

  async listPage({ signal, ...options }: PipelinePageOptions = {}): Promise<
    PipelineStoragePage<RemotePipelineDescriptor>
  > {
    const connection = await this.connect();
    const page = await listCloudPipelinePage(
      { ...connection, signal: signal ?? connection.signal },
      options,
    );
    return {
      files: page.pipelines.map((pipeline) => this.describe(pipeline)),
      nextPageToken: page.nextPageToken,
      totalCount: page.totalCount,
    };
  }

  async read(
    storageKey: string,
  ): Promise<PipelineReadResult<RemotePipelineDescriptor<CloudPipeline>>> {
    const reference = this.parseReference(storageKey);
    const pipeline = await getCloudPipeline(
      reference.pipelineId,
      await this.connect(),
    );
    return {
      content: yaml.dump(cloudPipelineToComponentSpec(pipeline)),
      descriptor: this.describe(pipeline),
    };
  }

  async write(
    storageKey: string,
    content: string,
    options: PipelineWriteOptions<RemotePipelineDescriptor> = {},
  ): Promise<RemotePipelineDescriptor<CloudPipeline>> {
    const connection = await this.connect();
    const spec = yaml.load(content, PIPELINE_YAML_LOAD_OPTIONS);
    if (!isValidComponentSpec(spec))
      throw new Error("The pipeline is not a valid component definition.");
    const existing = options.existing
      ? await this.loadTemplate(options.existing)
      : storageKey.startsWith("remote:")
        ? (await this.read(storageKey)).descriptor.pipeline
        : undefined;
    if (existing && this.describe(existing).storageKey !== storageKey)
      throw new Error("The pipeline does not match its storage key.");
    const source = options.source
      ? await this.loadTemplate(options.source)
      : undefined;
    const pipeline = await writeCloudPipeline(
      {
        filePath: existing?.file_path ?? storageKey,
        componentSpec: spec,
        existingPipeline: existing,
        sourcePipeline: source,
      },
      connection,
    );
    return {
      ...this.describe(pipeline),
      displayName: pipeline.pipeline_name ?? spec.name,
    };
  }

  async rename(
    storageKey: string,
    name: string,
  ): Promise<RemotePipelineDescriptor<CloudPipeline>> {
    const { content, descriptor } = await this.read(storageKey);
    const spec = yaml.load(content, PIPELINE_YAML_LOAD_OPTIONS);
    if (!isValidComponentSpec(spec))
      throw new Error("Invalid pipeline definition.");
    spec.name = name;
    return this.write(storageKey, yaml.dump(spec), { existing: descriptor });
  }

  async delete(
    storageKey: string,
    descriptor?: RemotePipelineDescriptor,
  ): Promise<void> {
    this.parseReference(storageKey);
    if (
      descriptor &&
      (descriptor.storageKey !== storageKey ||
        this.describe(descriptor.pipeline).storageKey !== storageKey)
    )
      throw new Error("The pipeline does not match its storage key.");
    const pipeline =
      descriptor?.pipeline ?? (await this.read(storageKey)).descriptor.pipeline;
    await deleteCloudPipeline(pipeline, await this.connect());
  }

  async hasKey(storageKey: string): Promise<boolean> {
    this.parseReference(storageKey);
    return (await this.list()).some((file) => file.storageKey === storageKey);
  }

  private parseReference(storageKey: string) {
    const reference = parseRemotePipelineReference(storageKey);
    if (!reference || reference.backendUrl !== this.backendUrl)
      throw new Error("This pipeline belongs to a different backend.");
    return reference;
  }

  private async loadTemplate(
    descriptor: RemotePipelineDescriptor,
  ): Promise<CloudPipeline> {
    this.parseReference(descriptor.storageKey);
    const pipeline = descriptor.pipeline;
    if (this.describe(pipeline).storageKey !== descriptor.storageKey)
      throw new Error("The pipeline does not match its storage key.");
    if (isLoadedPipeline(pipeline)) return pipeline;
    return (await this.read(descriptor.storageKey)).descriptor.pipeline;
  }
}

function isLoadedPipeline(
  pipeline: CloudPipelineSummary | CloudPipeline,
): pipeline is CloudPipeline {
  return "root_pipeline_task" in pipeline;
}
