import { InfoBox } from "@/components/shared/InfoBox";

export function BackendUnavailable() {
  return (
    <InfoBox title="Backend not available" variant="warning">
      The configured backend is currently unavailable.
    </InfoBox>
  );
}
