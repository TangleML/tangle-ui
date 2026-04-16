import { action, makeObservable, observable } from "mobx";

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

export class PipelineFileStore {
  @observable accessor activePipelineFile: PipelineFile | null = null;

  constructor() {
    makeObservable(this);
  }

  @action init(pipelineFile: PipelineFile | null) {
    this.activePipelineFile = pipelineFile;
  }

  @action dispose() {
    this.activePipelineFile = null;
  }
}
