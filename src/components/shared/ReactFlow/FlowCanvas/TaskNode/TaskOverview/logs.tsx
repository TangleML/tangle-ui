import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { Link } from "@/components/ui/link";
import { Spinner } from "@/components/ui/spinner";
import { useBackend } from "@/providers/BackendProvider";
import { getBackendStatusString } from "@/utils/backend";
import { CONTAINER_STATUSES_PRE_LAUNCH } from "@/utils/executionStatus";

const LogDisplay = ({
  logs,
}: {
  logs: {
    log_text?: string;
    system_error_exception_full?: string;
  };
}) => {
  if (!logs.log_text && !logs.system_error_exception_full) {
    return <div>No logs available</div>;
  }

  const hasLogs = !!logs?.log_text;
  const hasErrors = !!logs?.system_error_exception_full;
  const hasBoth = hasLogs && hasErrors;

  const logWrapperStyle = hasBoth ? "flex-1 min-h-0" : "h-full";

  return (
    <div className="flex flex-col h-full gap-2">
      {hasLogs && (
        <div className={logWrapperStyle}>
          <CodeViewer
            code={logs.log_text || ""}
            language="text"
            filename="Execution Logs"
            scrollToBottom
          />
        </div>
      )}
      {hasErrors && (
        <div className={logWrapperStyle}>
          <CodeViewer
            code={logs.system_error_exception_full || ""}
            language="text"
            filename="System Error Logs"
            scrollToBottom
          />
        </div>
      )}
    </div>
  );
};

/**
 * Statuses where the container is running and actively producing logs.
 * Used to decide whether to poll for new log content.
 */
const isStatusActivelyLogging = (status?: string): boolean => {
  switch (status) {
    case "RUNNING":
    case "PENDING":
    case "CANCELLING":
      return true;
    default:
      return false;
  }
};

/**
 * Returns true if the container may have logs worth fetching.
 */
const shouldStatusHaveLogs = (status?: string): boolean => {
  if (!status) {
    return false;
  }
  return !CONTAINER_STATUSES_PRE_LAUNCH.has(status);
};

const getLogs = async (executionId: string, backendUrl: string) => {
  const response = await fetch(
    `${backendUrl}/api/executions/${executionId}/container_log`,
  );
  return response.json();
};

const Logs = ({
  executionId,
  status,
}: {
  executionId?: string | number;
  status?: string;
}) => {
  const { backendUrl, configured, available } = useBackend();

  const shouldFetch = !!executionId && shouldStatusHaveLogs(status);
  const shouldPoll = shouldFetch && isStatusActivelyLogging(status);

  const [logs, setLogs] = useState<{
    log_text?: string;
    system_error_exception_full?: string;
  }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["logs", executionId],
    queryFn: () => getLogs(String(executionId), backendUrl),
    enabled: shouldFetch,
    refetchInterval: shouldPoll ? 5000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (data && !error) {
      setLogs({
        log_text: data?.log_text,
        system_error_exception_full: data?.system_error_exception_full,
      });
    }

    if (error) {
      setLogs({ log_text: "No logs available" });
    }
  }, [data, error]);

  useEffect(() => {
    if (shouldFetch) {
      refetch();
    }
  }, [backendUrl, refetch, shouldFetch]);

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to view execution logs.
      </InfoBox>
    );
  }

  if (!shouldFetch && !logs) {
    return (
      <InfoBox title="No logs available" variant="info">
        Logs are available only for active, queued and completed executions.
      </InfoBox>
    );
  }

  if (isLoading) {
    return (
      <div className="flex gap-2 items-center">
        <Spinner /> Loading Logs...
      </div>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <InfoBox title="Error loading logs" variant="error">
        <div className="mb-2">{error.message}</div>
        <div className="text-black italic">{backendStatusString}</div>
      </InfoBox>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <div className="font-mono text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg h-full min-h-0 flex-1">
        {logs && <LogDisplay logs={logs} />}
      </div>
    </div>
  );
};

export const OpenLogsInNewWindowLink = ({
  executionId,
  status,
}: {
  executionId: string;
  status?: string;
}) => {
  const { backendUrl, available } = useBackend();
  const logsUrl = `${backendUrl}/api/executions/${executionId}/stream_container_log`;

  if (!executionId || !shouldStatusHaveLogs(status)) {
    return null;
  }

  return (
    <Link
      href={logsUrl}
      external
      variant={available ? "primary" : "disabled"}
      size="sm"
      aria-label={
        available
          ? "Open logs in a new tab"
          : "Cant open logs: Backend not available"
      }
    >
      Open in new tab
    </Link>
  );
};

export default Logs;
