import Bugsnag from "@bugsnag/js";
import React, { type ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { ErrorPage } from "@/components/shared/ErrorPage";
import { IS_BUGSNAG_ENABLED } from "@/services/errorManagement/bugsnag";

interface ErrorBoundaryProps {
  children: ReactNode;
}

const ErrorFallback = (props: {
  error: unknown;
  resetErrorBoundary: () => void;
}) => <ErrorPage error={props.error} reset={props.resetErrorBoundary} />;

export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  if (IS_BUGSNAG_ENABLED) {
    const reactPlugin = Bugsnag.getPlugin("react");
    if (reactPlugin) {
      const BugsnagBoundary = reactPlugin.createErrorBoundary(React);

      return (
        <BugsnagBoundary
          FallbackComponent={(props: {
            error: Error;
            info: React.ErrorInfo;
            clearError: () => void;
          }) => <ErrorPage error={props.error} reset={props.clearError} />}
        >
          {children}
        </BugsnagBoundary>
      );
    }

    console.error(
      "Bugsnag React plugin not initialized. Falling back to react-error-boundary.",
    );
  }

  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
};
