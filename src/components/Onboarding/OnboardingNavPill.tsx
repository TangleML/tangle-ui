import { OnboardingChecklist } from "@/components/Onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Heading } from "@/components/ui/typography";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { tracking } from "@/utils/tracking";

export function OnboardingNavPill() {
  const { completedCount, total, shouldShowOnboarding } = useOnboarding();

  if (!shouldShowOnboarding) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild {...tracking("navigation.onboarding_pill")}>
        <Button variant="nav" size="sm" shape="pill">
          <Icon name="Rocket" size="sm" aria-hidden="true" />
          Onboarding · {completedCount}/{total}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <BlockStack gap="3">
          <Heading level={3}>Get started with Tangle</Heading>
          <OnboardingChecklist />
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
