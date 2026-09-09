import { InfoBox } from "@/components/shared/InfoBox";
import { getPipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

export function BackendUnavailable() {
  const { mode } = getPipelineStorageService();
  const errorMessage =
    mode.kind === "backend"
      ? "The configured backend is currently unavailable."
      : "Pipeline storage is currently unavailable.";

  return (
    <InfoBox title="Backend not available" variant="warning">
      {errorMessage}
    </InfoBox>
  );
}
