import { type ReactNode, useEffect } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { errorReporter } from "@/services/errorManagement";

interface BugsnagProviderProps {
  children: ReactNode;
  fallback: (props: FallbackProps) => ReactNode;
}

export const BugsnagProvider = ({
  children,
  fallback,
}: BugsnagProviderProps) => {
  useEffect(() => {
    if (errorReporter.isEnabled()) {
      errorReporter.startSession();
    }

    // Global error handler for uncaught errors (catches event handler errors!)
    const handleGlobalError = (event: ErrorEvent) => {
      errorReporter.report(event.error || new Error(event.message), {
        metadata: {
          type: "uncaught_error",
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    // Global handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));

      errorReporter.report(error, {
        metadata: {
          type: "unhandled_rejection",
          reason: event.reason,
        },
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );

      // Clean up Bugsnag (send remaining queued errors)
      errorReporter.cleanup();
    };
  }, []);

  const handleError = (
    error: unknown,
    info: { componentStack?: string | null },
  ) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    errorReporter.report(errorObj, {
      metadata: {
        componentStack: info.componentStack || undefined,
        type: "react_error_boundary",
      },
    });
  };

  return (
    <ErrorBoundary FallbackComponent={fallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
};
