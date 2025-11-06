import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { CodeViewer } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { Link } from "@/components/ui/link";
import { Spinner } from "@/components/ui/spinner";
import { useBackend } from "@/providers/BackendProvider";
import type { RunStatus } from "@/types/pipelineRun";
import { getBackendStatusString } from "@/utils/backend";

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
            title="Execution Logs"
            filename="Execution Logs"
          />
        </div>
      )}
      {hasErrors && (
        <div className={logWrapperStyle}>
          <CodeViewer
            code={logs.system_error_exception_full || ""}
            language="text"
            title="System Error Logs"
            filename="System Error Logs"
          />
        </div>
      )}
    </div>
  );
};

const isStatusActivelyLogging = (
  status?: ContainerExecutionStatus | RunStatus,
): boolean => {
  if (!status) {
    return false;
  }
  switch (status) {
    case "RUNNING":
    case "PENDING":
    case "QUEUED":
    case "WAITING_FOR_UPSTREAM":
    case "CANCELLING":
      return true;
    default:
      return false;
  }
};

const shouldStatusHaveLogs = (
  status?: ContainerExecutionStatus | RunStatus,
): boolean => {
  if (!status) {
    return false;
  }

  if (isStatusActivelyLogging(status)) {
    return true;
  }

  switch (status) {
    case "FAILED":
    case "SYSTEM_ERROR":
    case "SUCCEEDED":
    case "CANCELLED":
      return true;
    default:
      return false;
  }
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
  status?: ContainerExecutionStatus | RunStatus;
}) => {
  const { backendUrl, configured, available } = useBackend();

  const [isLogging, setIsLogging] = useState(!!executionId);
  const [shouldHaveLogs, setShouldHaveLogs] = useState(!!executionId);
  const [logs, setLogs] = useState<{
    log_text?: string;
    system_error_exception_full?: string;
  }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["logs", executionId],
    queryFn: () => getLogs(String(executionId), backendUrl),
    enabled: isLogging,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (status) {
      setIsLogging(isStatusActivelyLogging(status));
      setShouldHaveLogs(shouldStatusHaveLogs(status));
    }
  }, [status]);

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
    refetch();
  }, [backendUrl, refetch]);

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to view execution logs.
      </InfoBox>
    );
  }

  if (!shouldHaveLogs) {
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
  status?: ContainerExecutionStatus | RunStatus;
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
      variant={available ? "link" : "disabled"}
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
