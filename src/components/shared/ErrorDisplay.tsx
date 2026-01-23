import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";

interface ErrorDisplayProps {
  error: unknown;
  onRefresh: () => void;
  onGoHome: () => void;
}

/**
 * Shared error display component used by both ErrorFallback and ErrorPage.
 * Shows a user-friendly error message with options to refresh or go home.
 */
export const ErrorDisplay = ({
  error,
  onRefresh,
  onGoHome,
}: ErrorDisplayProps) => {
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
            <Button onClick={onRefresh} className="w-full">
              Try Again
            </Button>

            <Button onClick={onGoHome} variant="secondary" className="w-full">
              Go Home
            </Button>
          </BlockStack>
        </BlockStack>
      </div>
    </div>
  );
};
