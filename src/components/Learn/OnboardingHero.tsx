import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
}

const STUB_STEPS: OnboardingStep[] = [
  { id: "configure-backend", label: "Connect a backend", completed: true },
  { id: "import-sample", label: "Import a sample pipeline", completed: true },
  { id: "run-pipeline", label: "Run your first pipeline", completed: false },
  { id: "edit-component", label: "Edit a component", completed: false },
  {
    id: "create-pipeline",
    label: "Build a pipeline from scratch",
    completed: false,
  },
];

export function OnboardingHero() {
  const completed = STUB_STEPS.filter((s) => s.completed).length;
  const total = STUB_STEPS.length;
  const isComplete = completed === total;
  const nextStep = STUB_STEPS.find((s) => !s.completed);

  return (
    <div className="rounded-xl border border-border bg-linear-to-br from-primary/5 to-transparent p-6">
      <BlockStack gap="4">
        <InlineStack gap="4" align="space-between" blockAlign="start">
          <BlockStack gap="2">
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
                ? "Onboarding complete — explore tours and tips below to keep going."
                : "Follow a few quick steps to get from zero to your first pipeline run."}
            </Paragraph>
          </BlockStack>
          {!isComplete && nextStep && (
            <Button
              asChild
              size="sm"
              {...tracking("learning_hub.onboarding.resume")}
            >
              <Link to="/learn">
                Resume
                <Icon name="ArrowRight" size="sm" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </InlineStack>

        <BlockStack gap="2">
          <InlineStack gap="3" blockAlign="center">
            <Text size="xs" tone="subdued" weight="semibold">
              {completed} of {total} steps
            </Text>
            <div
              className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Onboarding progress"
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </InlineStack>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 list-none p-0 m-0">
            {STUB_STEPS.map((step) => (
              <li key={step.id} className="flex items-center gap-1.5 text-xs">
                <Icon
                  name={step.completed ? "CircleCheck" : "Circle"}
                  size="sm"
                  className={cn(
                    step.completed
                      ? "text-primary"
                      : "text-muted-foreground/60",
                  )}
                  aria-hidden="true"
                />
                <Text
                  size="xs"
                  tone={step.completed ? "subdued" : "inherit"}
                  className={cn(step.completed && "line-through")}
                >
                  {step.label}
                </Text>
              </li>
            ))}
          </ul>
        </BlockStack>
      </BlockStack>
    </div>
  );
}
