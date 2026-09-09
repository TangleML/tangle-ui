import { InfoBox } from "@/components/shared/InfoBox";
import { getPipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

export function BackendUnavailable() {
  const { mode } = getPipelineStorageService();

  return (
    <InfoBox title="Backend not available" variant="warning">
      {mode.kind === "host" ? mode.label : "Pipeline storage"} is not answering.
      Pipelines cannot be read or saved until it is back.
    </InfoBox>
  );
}
