import { useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";

export default function NotFoundPage() {
  const router = useRouter();

  const handleGoHome = () => {
    router.navigate({ to: "/" });
  };

  const handleGoBack = () => {
    router.history.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-xs w-full">
        <BlockStack gap="8" align="center">
          <BlockStack gap="2" align="center">
            <Text size="2xl" weight="bold">
              Page not found
            </Text>
            <Paragraph tone="subdued" size="sm">
              The page you&apos;re looking for doesn&apos;t exist.
            </Paragraph>
          </BlockStack>

          <BlockStack gap="3">
            <Button onClick={handleGoBack} className="w-full">
              Go Back
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
