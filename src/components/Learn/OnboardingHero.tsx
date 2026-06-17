import { OnboardingChecklist } from "@/components/Onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";

function scrollNearestScrollableToTop(el: HTMLElement | null) {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      node.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    node = node.parentElement;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function OnboardingHero() {
  const { isComplete, dismissed, dismiss, reopen } = useOnboarding();

  if (dismissed) {
    return (
      <InlineStack align="end" className="text-muted-foreground opacity-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            reopen();
            scrollNearestScrollableToTop(e.currentTarget);
          }}
        >
          <Icon name="Rocket" size="sm" aria-hidden="true" />
          {isComplete ? "Onboarding (complete)" : "Resume onboarding"}
          {isComplete && (
            <Icon name="ArrowRight" size="sm" aria-hidden="true" />
          )}
        </Button>
      </InlineStack>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-linear-to-br from-primary/5 to-transparent p-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dismiss onboarding"
        className="absolute right-3 top-3 hover:bg-transparent hover:text-muted-foreground"
      >
        <Icon name="X" size="sm" aria-hidden="true" />
      </Button>

      <BlockStack gap="4">
        <BlockStack gap="2" className="min-w-0 pr-8">
          <InlineStack gap="2" blockAlign="center">
            <Icon
              name="Rocket"
              size="lg"
              className="text-primary"
              aria-hidden="true"
            />
            <Heading level={2}>
              {isComplete ? "You're all set up!" : "Welcome to Tangle"}
            </Heading>
          </InlineStack>
          <Paragraph tone="subdued" size="sm">
            {isComplete
              ? "Onboarding complete - explore tours and tips below to keep going."
              : "Follow a few quick steps to get from zero to your first pipeline run."}
          </Paragraph>
        </BlockStack>

        <OnboardingChecklist />
      </BlockStack>
    </div>
  );
}
