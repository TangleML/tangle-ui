import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import { PipelineSpecApiError } from "@/services/pipelineSpecService";
import { RemotePipelineDeletionError } from "@/services/pipelineStorage/remotePipelineDeletion";

import { RemotePipelineShell } from "./RemotePipelineShell";

function describeError(error: unknown) {
  if (error instanceof RemotePipelineDeletionError) {
    return {
      message:
        error.state === "deleted"
          ? "This pipeline was deleted."
          : error.state === "pending"
            ? "This pipeline is being deleted."
            : "The deletion result is unknown. Return to pipelines and delete it again to confirm.",
      retryable: error.state === "pending",
    };
  }
  if (error instanceof PipelineSpecApiError) {
    switch (error.status) {
      case 401:
        return {
          message: "Sign in, then retry to view this pipeline.",
          retryable: true,
        };
      case 403:
        return {
          message:
            "You don't have access to this pipeline. Check your sign-in, then retry.",
          retryable: true,
        };
      case 404:
      case 422:
        return { message: "Pipeline not found.", retryable: false };
      default:
        return {
          message:
            error.status >= 500
              ? "The server couldn't load this pipeline. Try again."
              : "The server couldn't load this pipeline. Check the link or try again.",
          retryable:
            error.status >= 500 || error.status === 408 || error.status === 429,
        };
    }
  }
  return {
    message: "Unable to load pipeline. Please try again.",
    retryable: true,
  };
}

export function RemotePipelineError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { message, retryable } = describeError(error);
  const authStorage = useAuthLocalStorage();
  const token = useSyncExternalStore(
    authStorage.subscribe,
    authStorage.getToken,
  );
  const previousToken = useRef(token);
  useEffect(() => {
    const changed = token !== previousToken.current;
    previousToken.current = token;
    if (
      error instanceof PipelineSpecApiError &&
      (error.status === 401 || error.status === 403) &&
      token &&
      changed
    ) {
      onRetry();
    }
  }, [error, token, onRetry]);

  return (
    <RemotePipelineShell>
      <BlockStack
        fill
        align="center"
        inlineAlign="center"
        gap="3"
        className="p-6"
      >
        <Paragraph role="alert">{message}</Paragraph>
        {retryable && (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
        <Button asChild variant="outline">
          <RouterLink to={APP_ROUTES.DASHBOARD_PIPELINES}>
            Back to pipelines
          </RouterLink>
        </Button>
      </BlockStack>
    </RemotePipelineShell>
  );
}
