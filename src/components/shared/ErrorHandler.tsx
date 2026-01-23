import Bugsnag from "@bugsnag/js";
import { useEffect } from "react";

import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { getBugsnagConfig } from "@/services/errorManagement/bugsnag";

interface ErrorHandlerProps {
  error: unknown;
  errorType: "app_error_boundary" | "router_error";
  resetErrorBoundary?: () => void;
  onGoHome?: () => void;
}

/**
 * Unified error handler component used for both React Error Boundaries and Router errors.
 * Automatically reports errors to Bugsnag and provides a user-friendly error display.
 */
export const ErrorHandler = ({
  error,
  errorType,
  resetErrorBoundary,
  onGoHome,
}: ErrorHandlerProps) => {
  useEffect(() => {
    const config = getBugsnagConfig();

    if (config.enabled && error instanceof Error) {
      Bugsnag.notify(error, (event) => {
        event.addMetadata("error_handler", {
          type: errorType,
          pathname: window.location.pathname,
        });
      });
    }
  }, [error, errorType]);

  const handleRefresh = () => {
    // Reset error boundary if available before reloading
    resetErrorBoundary?.();
    window.location.reload();
  };

  const handleGoHomeClick = () => {
    // Reset error boundary if available
    resetErrorBoundary?.();

    // Use custom handler if provided, otherwise use window.location
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <ErrorDisplay
      error={error}
      onRefresh={handleRefresh}
      onGoHome={handleGoHomeClick}
    />
  );
};
