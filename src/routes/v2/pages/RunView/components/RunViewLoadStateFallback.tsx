import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { RemoteAuthErrorView } from "@/components/shared/RemoteAuthErrorView";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { RunViewLoadState } from "@/routes/v2/pages/RunView/hooks/useRunViewLoadState";

interface RunViewLoadStateFallbackProps {
  state: Exclude<RunViewLoadState, { status: "spec" }>;
}

export function RunViewLoadStateFallback({
  state,
}: RunViewLoadStateFallbackProps) {
  switch (state.status) {
    case "loading":
      return <LoadingScreen message="Loading Pipeline Run" />;
    case "not-configured":
      return (
        <BlockStack fill>
          <InfoBox title="Backend not configured" variant="warning">
            Configure a backend to view this pipeline run.
          </InfoBox>
        </BlockStack>
      );
    case "not-available":
      return (
        <BlockStack fill>
          <InfoBox title="Backend not available" variant="error">
            The configured backend is not available.
          </InfoBox>
        </BlockStack>
      );
    case "auth-error":
      return <RemoteAuthErrorView />;
    case "error":
      return (
        <BlockStack fill>
          <InfoBox title="Error loading pipeline run" variant="error">
            <Paragraph size="sm" className="mb-2">
              {state.error.message}
            </Paragraph>
            <Paragraph size="sm" className="italic">
              {state.backendStatus}
            </Paragraph>
          </InfoBox>
        </BlockStack>
      );
    case "empty":
      return null;
  }
}
