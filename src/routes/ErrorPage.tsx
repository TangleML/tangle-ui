import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";

export default function ErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    router.navigate({ to: "/" });
  };

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
              {error?.message || "An unexpected error occurred"}
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
}
