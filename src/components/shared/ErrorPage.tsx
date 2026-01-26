import Bugsnag from "@bugsnag/js";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { getBugsnagConfig } from "@/services/errorManagement/bugsnag";

/**
 * Unified props for ErrorPage component.
 * Supports both router error props (reset) and react-error-boundary props (resetErrorBoundary).
 */
interface ErrorPageProps {
  error: unknown;
  reset?: () => void;
  resetErrorBoundary?: () => void;
}

export const ErrorPage = ({
  error,
  reset,
  resetErrorBoundary,
}: ErrorPageProps) => {
  const router = useRouter();

  // Use whichever reset function is provided
  const resetFn = resetErrorBoundary ?? reset;

  // Report error to Bugsnag when used from router (ErrorBoundary component handles its own reporting)
  useEffect(() => {
    // Only report if this is a router error (has 'reset' instead of 'resetErrorBoundary')
    if (reset) {
      const config = getBugsnagConfig();

      if (config.enabled && error instanceof Error) {
        Bugsnag.notify(error, (event) => {
          event.addMetadata("error_handler", {
            pathname: window.location.pathname,
          });
        });
      }
    }
  }, [error, reset]);

  const handleRefresh = () => {
    // Reset error boundary if available
    resetFn?.();
    window.location.reload();
  };

  const handleGoHome = () => {
    // Reset error boundary if available
    resetFn?.();
    router.navigate({ to: "/" });
  };

  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-xs w-full">
        <BlockStack gap="8" align="center">
          <BlockStack gap="2" align="center">
            <Text size="2xl" weight="bold">
              Something went wrong
            </Text>
            <Paragraph tone="subdued" size="sm">
              An unexpected error occurred.
            </Paragraph>
          </BlockStack>

          <InfoBox title="Error Details" variant="error">
            <Paragraph font="mono" size="xs">
              {errorMessage}
            </Paragraph>
          </InfoBox>

          <BlockStack gap="3">
            <Button onClick={handleRefresh} className="w-full">
              Try Again
            </Button>

            <Button
              onClick={handleGoHome}
              variant="secondary"
              className="w-full"
            >
              Go Home
            </Button>
          </BlockStack>
        </BlockStack>
      </div>
    </div>
  );
};
