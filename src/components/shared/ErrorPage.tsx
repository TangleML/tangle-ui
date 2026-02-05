import Bugsnag, { type Event } from "@bugsnag/js";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { IS_BUGSNAG_ENABLED } from "@/services/errorManagement/bugsnag";

const ERROR_HANDLER_METADATA_KEY = "error_handler";

interface ErrorPageProps {
  error: unknown;
  reset?: () => void;
}

export const ErrorPage = ({ error, reset = () => {} }: ErrorPageProps) => {
  const router = useRouter();

  useEffect(() => {
    if (IS_BUGSNAG_ENABLED && error instanceof Error) {
      Bugsnag.notify(error, (event: Event) => {
        event.addMetadata(ERROR_HANDLER_METADATA_KEY, {
          pathname: window.location.pathname,
        });
      });
    }
  }, [error]);

  const handleRefresh = () => {
    reset();
    window.location.reload();
  };

  const handleGoHome = () => {
    reset();
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
