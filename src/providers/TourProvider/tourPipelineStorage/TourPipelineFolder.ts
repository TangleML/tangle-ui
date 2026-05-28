import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

export class TourPipelineFolder extends PipelineFolder {
  override async listPipelines(): Promise<PipelineFile[]> {
    const descriptors = await this.driver.list();
    return descriptors.map(
      (d) =>
        new PipelineFile({
          id: d.storageKey,
          storageKey: d.storageKey,
          folder: this,
          createdAt: d.createdAt,
          modifiedAt: d.modifiedAt,
        }),
    );
  }

  override async findFile(
    storageKey: string,
  ): Promise<PipelineFile | undefined> {
    if (!(await this.driver.hasKey(storageKey))) return undefined;
    return new PipelineFile({
      id: storageKey,
      storageKey,
      folder: this,
    });
  }

  override async assignFile(storageKey: string): Promise<PipelineFile> {
    return new PipelineFile({
      id: storageKey,
      storageKey,
      folder: this,
    });
  }

  override async addFile(
    storageKey: string,
    content: string,
  ): Promise<PipelineFile> {
    await this.driver.write(storageKey, content);
    return new PipelineFile({
      id: storageKey,
      storageKey,
      folder: this,
    });
  }
}
