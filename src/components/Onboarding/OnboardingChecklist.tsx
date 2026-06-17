import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link as ExternalLink } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  type OnboardingStep,
  useOnboarding,
} from "@/providers/OnboardingProvider/OnboardingProvider";
import { DOCUMENTATION_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

function StepCta({ step }: { step: OnboardingStep }) {
  if (step.id === "read_docs") {
    return (
      <ExternalLink
        href={DOCUMENTATION_URL}
        external
        variant="primary"
        size="sm"
        {...tracking("learning_hub.onboarding.step", { step_id: step.id })}
      >
        {step.cta.label}
      </ExternalLink>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      {...tracking("learning_hub.onboarding.step", { step_id: step.id })}
    >
      <Link to={step.cta.to}>{step.cta.label}</Link>
    </Button>
  );
}

function StepRow({ step }: { step: OnboardingStep }) {
  return (
    <InlineStack as="li" gap="3" blockAlign="start" wrap="nowrap">
      <Icon
        name={step.completed ? "CircleCheck" : step.icon}
        size="md"
        className={cn(
          "mt-0.5 shrink-0",
          step.completed ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <BlockStack className="min-w-0 flex-1">
        <Text
          size="sm"
          weight="semibold"
          tone={step.completed ? "subdued" : "inherit"}
          className={cn(step.completed && "line-through")}
        >
          {step.label}
        </Text>
        <Text size="xs" tone="subdued">
          {step.description}
        </Text>
      </BlockStack>
      {!step.completed && <StepCta step={step} />}
    </InlineStack>
  );
}

export function OnboardingChecklist() {
  const { steps, completedCount, total } = useOnboarding();

  return (
    <BlockStack gap="4">
      <InlineStack gap="3" blockAlign="center">
        <Text size="xs" tone="subdued" weight="semibold">
          {completedCount} of {total} steps
        </Text>
        <div
          className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
      </InlineStack>

      <BlockStack as="ul" gap="3" align="stretch" className="list-none p-0 m-0">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </BlockStack>
    </BlockStack>
  );
}
