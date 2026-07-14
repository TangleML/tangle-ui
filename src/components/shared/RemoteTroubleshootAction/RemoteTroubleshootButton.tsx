import "@/config/remoteTroubleshootAction";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { RemoteTroubleshootActionConfig } from "@/config/remoteTroubleshootAction";
import { useFetchExecutionDetails } from "@/services/executionService";
import {
  getRemoteTroubleshootRecord,
  saveRemoteTroubleshootRecord,
} from "@/utils/remoteTroubleshootStorage";
import { getUserDetails } from "@/utils/user";

import { RemoteTroubleshootDialog } from "./RemoteTroubleshootDialog";

const ALWAYS_ELIGIBLE_STATUSES = new Set([
  "CANCELLED",
  "SYSTEM_ERROR",
  "FAILED",
]);
const TIMER_ELIGIBLE_STATUSES = new Set(["PENDING", "QUEUED"]);
const PENDING_THRESHOLD_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

function isLocalEnvironment(): boolean {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
}

function getConfig(): RemoteTroubleshootActionConfig | null {
  return window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__ ?? null;
}

interface RemoteTroubleshootButtonProps {
  runId: string;
  executionId: string | undefined;
  taskName: string;
  status: string | undefined;
}

export function RemoteTroubleshootButton({
  runId,
  executionId,
  taskName,
  status,
}: RemoteTroubleshootButtonProps) {
  const config = getConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timerReady, setTimerReady] = useState(false);

  const isTimerStatus =
    status !== undefined && TIMER_ELIGIBLE_STATUSES.has(status);
  const isAlwaysEligible =
    status !== undefined && ALWAYS_ELIGIBLE_STATUSES.has(status);

  const { data: details } = useFetchExecutionDetails(
    executionId,
    status,
    isTimerStatus,
  );
  const lastStatusEntry = details?.status_history?.at(-1);
  const currentStatusSince =
    lastStatusEntry && lastStatusEntry.status === status
      ? lastStatusEntry.first_observed_at
      : undefined;

  useEffect(() => {
    if (!isTimerStatus || currentStatusSince === undefined) {
      setTimerReady(false);
      return;
    }

    const sinceMs = new Date(currentStatusSince).getTime();
    const isElapsed = () => Date.now() - sinceMs >= PENDING_THRESHOLD_MS;

    if (isElapsed()) {
      setTimerReady(true);
      return;
    }

    const intervalId = setInterval(() => {
      if (isElapsed()) {
        setTimerReady(true);
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isTimerStatus, currentStatusSince]);

  if (
    !config ||
    isLocalEnvironment() ||
    !status ||
    !executionId ||
    (!isAlwaysEligible && !(isTimerStatus && timerReady))
  ) {
    return null;
  }

  const existingRecord = getRemoteTroubleshootRecord(runId, executionId);

  if (existingRecord) {
    const requestedAt = new Date(existingRecord.requestedAt);
    const formatted = requestedAt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <InlineStack gap="1" className="px-1 py-1">
        <Paragraph size="xs" tone="subdued">
          {config.successMessage
            ? `${config.successMessage} (${formatted})`
            : `${config.buttonText} session opened ${formatted}.`}
        </Paragraph>
      </InlineStack>
    );
  }

  const buildExecutionUrl = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("nodeId", taskName);
    return url.toString();
  };

  const handleSubmit = async (additionalComments: string) => {
    let userEmail = "";
    try {
      const user = await getUserDetails();
      userEmail = user.id ?? "";
    } catch {
      // leave empty if unavailable
    }

    const payload = {
      execution_id: executionId,
      user_email: userEmail,
      pipeline_run_id: runId,
      pipeline_run_url: `${window.location.origin}${window.location.pathname}`,
      execution_url: buildExecutionUrl(),
      additional_comments: additionalComments,
      source: config.source ?? "tangle-ui",
    };

    const response = await fetch(config.endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Remote troubleshoot request failed: ${response.status}`);
    }

    saveRemoteTroubleshootRecord(runId, executionId);
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setDialogOpen(true)}
      >
        {config.buttonText}
      </Button>
      <RemoteTroubleshootDialog
        open={dialogOpen}
        title={config.modalTitle ?? config.buttonText}
        description={config.modalDescription}
        successTitle={config.successTitle ?? "Request submitted"}
        successMessage={
          config.successMessage ??
          "Your request has been submitted successfully."
        }
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
