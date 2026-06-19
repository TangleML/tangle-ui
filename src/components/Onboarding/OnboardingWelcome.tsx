import { Link, Navigate } from "@tanstack/react-router";

import { OnboardingHero } from "@/components/Learn/OnboardingHero";
import { BlockStack } from "@/components/ui/layout";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { APP_ROUTES } from "@/routes/router";
import { tracking } from "@/utils/tracking";

export function OnboardingWelcome() {
  const { isReady, isComplete, dismissed } = useOnboarding();

  if (isReady && (isComplete || dismissed)) {
    return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  }

  return (
    <BlockStack
      gap="4"
      align="center"
      inlineAlign="center"
      className="h-full w-full"
    >
      <div className="w-full max-w-2xl">
        <OnboardingHero />
      </div>
      <Link
        to={APP_ROUTES.LEARN}
        className="text-sm text-muted-foreground hover:text-foreground"
        {...tracking("homepage.onboarding.learning_hub")}
      >
        Explore the Learning Hub →
      </Link>
    </BlockStack>
  );
}
