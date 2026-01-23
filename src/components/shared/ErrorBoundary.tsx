import Bugsnag from "@bugsnag/js";
import React, { type ReactNode } from "react";

import { ErrorHandler } from "@/components/shared/ErrorHandler";
import { getBugsnagConfig } from "@/services/errorManagement/bugsnag";

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Generic ErrorBoundary that determines which error reporting service to use.
 * Currently supports Bugsnag, but can be extended to support other services.
 */
export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  const bugsnagConfig = getBugsnagConfig();

  // Use Bugsnag's ErrorBoundary if enabled
  if (bugsnagConfig.enabled) {
    const BugsnagBoundary = Bugsnag.getPlugin("react")!.createErrorBoundary(
      React,
    );

    return (
      <BugsnagBoundary
        FallbackComponent={(props: {
          error: Error;
          info: React.ErrorInfo;
          clearError: () => void;
        }) => (
          <ErrorHandler
            error={props.error}
            errorType="app_error_boundary"
            resetErrorBoundary={props.clearError}
          />
        )}
      >
        {children}
      </BugsnagBoundary>
    );
  }

  // Fallback: no error boundary (just render children)
  // In the future, this could check for other error reporting services
  return <>{children}</>;
};
