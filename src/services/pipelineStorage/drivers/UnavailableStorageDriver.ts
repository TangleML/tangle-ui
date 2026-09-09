import type { PipelineFileDescriptor, PipelineStorageDriver } from "../types";

class PipelineStorageUnavailableError extends Error {
  readonly name = "PipelineStorageUnavailableError";

  constructor() {
    super(
      "This deployment stores pipelines outside the browser, and that store was not provided by the page.",
    );
  }
}

/**
 * Stands in when the deployment requires a host-provided store and the page did
 * not supply one. Every operation refuses: falling back to browser storage
 * would write the user's work somewhere the deployment does not read from, and
 * they would only find out much later.
 */
export class UnavailableStorageDriver implements PipelineStorageDriver {
  readonly type = "unavailable";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;

  async list(): Promise<PipelineFileDescriptor[]> {
    throw new PipelineStorageUnavailableError();
  }

  async read(): Promise<string> {
    throw new PipelineStorageUnavailableError();
  }

  async write(): Promise<PipelineFileDescriptor> {
    throw new PipelineStorageUnavailableError();
  }

  async delete(): Promise<void> {
    throw new PipelineStorageUnavailableError();
  }

  async hasKey(): Promise<boolean> {
    throw new PipelineStorageUnavailableError();
  }
}
