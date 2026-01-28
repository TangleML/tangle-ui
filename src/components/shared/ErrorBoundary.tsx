import Bugsnag from "@bugsnag/js";
import React, { type ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { ErrorPage } from "@/components/shared/ErrorPage";
import { getBugsnagConfig } from "@/services/errorManagement/bugsnag";

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Application-wide error boundary that uses Bugsnag's error boundary when enabled,
 * or falls back to react-error-boundary when Bugsnag is not configured.
 */
export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  const bugsnagConfig = getBugsnagConfig();

  // Use Bugsnag's ErrorBoundary if enabled
  if (bugsnagConfig.enabled) {
    const BugsnagBoundary =
      Bugsnag.getPlugin("react")!.createErrorBoundary(React);

    return (
      <BugsnagBoundary
        FallbackComponent={(props: {
          error: Error;
          info: React.ErrorInfo;
          clearError: () => void;
        }) => (
          <ErrorPage
            error={props.error}
            resetErrorBoundary={props.clearError}
          />
        )}
      >
        {children}
      </BugsnagBoundary>
    );
  }

  // Fallback to react-error-boundary when Bugsnag is not enabled
  return (
    <ReactErrorBoundary FallbackComponent={ErrorPage}>
      {children}
    </ReactErrorBoundary>
  );
};
