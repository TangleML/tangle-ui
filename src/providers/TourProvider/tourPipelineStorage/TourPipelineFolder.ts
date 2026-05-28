import { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";

/**
 * Session-storage-backed folder for ephemeral tour pipelines. Files are built
 * with `id: storageKey` and have no IndexedDB registry entry, so the inherited
 * `PipelineFile.rename()` / `deleteFile()` — which call `updateEntry` /
 * `deleteEntry` against that registry — are unsupported in tour mode and would
 * no-op or error against the missing row. Latent today: the tour UI disables
 * rename/delete, so these paths are never reached.
 */
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
