import { OnboardingChecklist } from "@/components/Onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/typography";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { tracking } from "@/utils/tracking";

export function OnboardingNavPill() {
  const { completedCount, total, shouldShowOnboarding, dismiss } =
    useOnboarding();

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
          <Separator />
          <InlineStack align="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={dismiss}
              className="text-muted-foreground"
              {...tracking("navigation.onboarding_pill.dismiss")}
            >
              Dismiss onboarding
            </Button>
          </InlineStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
