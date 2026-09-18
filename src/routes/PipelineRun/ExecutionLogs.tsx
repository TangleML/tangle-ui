import { useParams } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import Logs from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useFetchExecutionDetails } from "@/services/executionService";
import { getRawExecutionLogsUrl } from "@/utils/URL";

interface ExecutionLogsBodyProps {
  executionId: string;
  status?: string;
  isLoading: boolean;
  error: Error | null;
}

const ExecutionLogsBody = ({
  executionId,
  status,
  isLoading,
  error,
}: ExecutionLogsBodyProps) => {
  if (error) {
    return (
      <InfoBox title="Error loading execution" variant="error" width="fit">
        {error.message}
      </InfoBox>
    );
  }

  if (isLoading) {
    return (
      <InlineStack gap="2">
        <Spinner /> Loading logs...
      </InlineStack>
    );
  }

  return (
    <Logs executionId={executionId} status={status} allowFullscreen={false} />
  );
};

const ExecutionLogsPage = () => {
  const { executionId } = useParams({
    from: "/main-layout/logs/$executionId",
  });
  const { backendUrl, configured } = useBackend();

  // Not container_state: it 409s for an execution that never got a container,
  // which is exactly when the system error log is the thing worth reading.
  const {
    data: details,
    isLoading,
    error,
  } = useFetchExecutionDetails(executionId, undefined, true);
  const status = details?.status_history?.at(-1)?.status;

  return (
    <BlockStack gap="4" align="stretch" className="h-full p-6">
      <InlineStack align="space-between" blockAlign="start" gap="4">
        <BlockStack gap="1">
          <Heading level={1}>Execution logs</Heading>
          <Text size="sm" tone="subdued">
            {executionId}
          </Text>
        </BlockStack>
        {configured && (
          <Link
            href={getRawExecutionLogsUrl(executionId, backendUrl)}
            external
            size="sm"
          >
            Raw
          </Link>
        )}
      </InlineStack>

      <BlockStack align="stretch" className="min-h-0 flex-1">
        <ExecutionLogsBody
          executionId={executionId}
          status={status}
          isLoading={isLoading}
          error={error}
        />
      </BlockStack>
    </BlockStack>
  );
};

export default ExecutionLogsPage;
