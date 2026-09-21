import { type ComponentPropsWithoutRef, useEffect, useState } from "react";

import {
  CodeViewer,
  type CodeViewerHeaderActions,
  CodeViewerHeaderButton,
} from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useContainerLog } from "@/hooks/useContainerLog";
import { useBackend } from "@/providers/BackendProvider";
import { getBackendStatusString } from "@/utils/backend";
import { shouldStatusHaveLogs } from "@/utils/executionStatus";
import { getExecutionLogsUrl } from "@/utils/URL";

const LogDisplay = ({
  logs,
  allowFullscreen,
  headerActions,
}: {
  logs: {
    log_text?: string;
    system_error_exception_full?: string;
  };
  allowFullscreen?: boolean;
  headerActions?: CodeViewerHeaderActions;
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
            allowFullscreen={allowFullscreen}
            headerActions={headerActions}
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
            allowFullscreen={allowFullscreen}
            headerActions={hasLogs ? undefined : headerActions}
          />
        </div>
      )}
    </div>
  );
};

const Logs = ({
  executionId,
  status,
  allowFullscreen = true,
  headerActions,
}: {
  executionId?: string | number;
  status?: string;
  allowFullscreen?: boolean;
  headerActions?: CodeViewerHeaderActions;
}) => {
  const { backendUrl, configured, available } = useBackend();

  const shouldFetch = !!executionId && shouldStatusHaveLogs(status);

  const [logs, setLogs] = useState<{
    log_text?: string;
    system_error_exception_full?: string;
  }>();
  const { data, isLoading, error, refetch } = useContainerLog(
    executionId,
    status,
  );

  useEffect(() => {
    if (data && !error) {
      setLogs({
        log_text: data?.log_text ?? undefined,
        system_error_exception_full:
          data?.system_error_exception_full ?? undefined,
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
      <InfoBox title="Backend not configured" variant="warning" width="fit">
        Configure a backend to view execution logs.
      </InfoBox>
    );
  }

  if (!shouldFetch && !logs) {
    return (
      <InfoBox title="No logs available" variant="info" width="fit">
        Logs are available only for active, queued and completed executions.
      </InfoBox>
    );
  }

  if (isLoading) {
    return (
      <InlineStack gap="2">
        <Spinner />
        <Text>Loading logs…</Text>
      </InlineStack>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <InfoBox title="Error loading logs" variant="error" width="fit">
        <div className="mb-2">{error.message}</div>
        <div className="text-muted-foreground italic">
          {backendStatusString}
        </div>
      </InfoBox>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <div className="font-mono text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg h-full min-h-0 flex-1">
        {logs && (
          <LogDisplay
            logs={logs}
            allowFullscreen={allowFullscreen}
            headerActions={headerActions}
          />
        )}
      </div>
    </div>
  );
};

type OpenLogsInNewWindowLinkProps = {
  executionId: string;
  status?: string;
  iconOnly?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "children" | "external" | "variant" | "size" | "aria-label"
>;

export const OpenLogsInNewWindowLink = ({
  executionId,
  status,
  iconOnly,
  ...linkRest
}: OpenLogsInNewWindowLinkProps) => {
  const { available } = useBackend();

  if (!executionId || !shouldStatusHaveLogs(status)) {
    return null;
  }

  const logsUrl = getExecutionLogsUrl(executionId);
  const label = available
    ? "Open logs in a new tab"
    : "Can't open logs — backend not available";

  if (iconOnly) {
    const iconLink = (
      <CodeViewerHeaderButton asChild>
        <Link
          href={logsUrl}
          external
          variant={available ? "block" : "disabled"}
          size="sm"
          title={available ? label : undefined}
          aria-label={label}
          {...linkRest}
        />
      </CodeViewerHeaderButton>
    );

    if (available) return iconLink;

    // The disabled link variant sets pointer-events-none, so its own title never
    // fires. The wrapper still receives hover, leaving the icon explainable.
    return <span title={label}>{iconLink}</span>;
  }

  return (
    <Link
      href={logsUrl}
      external
      variant={available ? "primary" : "disabled"}
      size="sm"
      aria-label={label}
      {...linkRest}
    >
      Open in new tab
    </Link>
  );
};

export default Logs;
