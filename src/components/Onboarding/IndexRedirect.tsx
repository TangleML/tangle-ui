import { Navigate } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

export function IndexRedirect() {
  const { isReady, isComplete, dismissed } = useOnboarding();

  if (!isReady) {
    return (
      <BlockStack align="center" inlineAlign="center" className="h-full">
        <Spinner />
      </BlockStack>
    );
  }

  const showOnboarding = !isComplete && !dismissed;
  return (
    <Navigate
      replace
      to={showOnboarding ? APP_ROUTES.WELCOME : APP_ROUTES.DASHBOARD}
    />
  );
}
