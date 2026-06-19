import { Navigate } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

export function IndexRedirect() {
  const { isResolved, shouldShowOnboarding } = useOnboarding();

  if (!isResolved) {
    return (
      <BlockStack align="center" inlineAlign="center" className="h-full">
        <Spinner />
      </BlockStack>
    );
  }

  return (
    <Navigate
      replace
      to={shouldShowOnboarding ? APP_ROUTES.WELCOME : APP_ROUTES.DASHBOARD}
    />
  );
}
