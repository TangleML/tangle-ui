import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";

export const LOADING_ACTION_DELAY_MS = 8000;

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen = ({
  message = "Loading content",
}: LoadingScreenProps) => {
  const [showDelayedAction, setShowDelayedAction] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setShowDelayedAction(true),
      LOADING_ACTION_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <BlockStack fill gap="8" className="bg-background">
      <BlockStack align="center">
        <Spinner size={32} />
        <Paragraph tone="subdued" size="sm" role="status">
          {message}
        </Paragraph>
      </BlockStack>
      {showDelayedAction && (
        <BlockStack gap="2" align="center">
          <Paragraph tone="subdued" size="sm">
            Stuck loading?
          </Paragraph>
          <Button asChild size="sm" variant="outline">
            <Link to={APP_ROUTES.HOME}>Return home</Link>
          </Button>
        </BlockStack>
      )}
    </BlockStack>
  );
};
