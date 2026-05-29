import { type ProviderProps, type StepType, useTour } from "@reactour/tour";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { cn } from "@/lib/utils";

import { tourActionLabel } from "./tourActionLabels";
import type { TourAction } from "./tourActions";
import { renderInline } from "./TourContent";
import { useTourProgress } from "./TourProgressContext";

type NextButtonProps = Parameters<NonNullable<ProviderProps["nextButton"]>>[0];

type NavButtonProps = {
  onClick?: () => void;
  kind?: "next" | "prev";
  hideArrow?: boolean;
  disabled?: boolean;
};

type NavButtonContext = {
  currentStep: number;
  stepsLength: number;
  setCurrentStep: NextButtonProps["setCurrentStep"];
  disableAll?: boolean;
  rtl?: boolean;
};

const NavButtonContext =
  createRequiredContext<NavButtonContext>("NavButtonContext");

function BoundNavButton({
  children,
  ...rest
}: PropsWithChildren<NavButtonProps>) {
  const ctx = useRequiredContext(NavButtonContext);
  return (
    <NavButton {...rest} {...ctx}>
      {children}
    </NavButton>
  );
}

function NavButton({
  currentStep,
  stepsLength,
  setCurrentStep,
  disableAll,
  rtl,
  onClick,
  kind = "next",
  hideArrow,
  disabled,
  children,
}: PropsWithChildren<NavButtonProps & NavButtonContext>) {
  const baseDisabled =
    kind === "next" ? stepsLength - 1 === currentStep : currentStep === 0;
  const isDisabled = disableAll ? true : baseDisabled || !!disabled;
  const handleClick = () => {
    if (isDisabled) return;
    if (onClick) onClick();
    else if (kind === "next")
      setCurrentStep(Math.min(currentStep + 1, stepsLength - 1));
    else setCurrentStep(Math.max(currentStep - 1, 0));
  };
  const inverted = rtl ? kind === "prev" : kind === "next";
  return (
    <Button
      variant="ghost"
      size={children ? "sm" : "icon"}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={`Go to ${kind} step`}
    >
      {!hideArrow ? (
        <Icon name={inverted ? "ChevronRight" : "ChevronLeft"} />
      ) : null}
      {children}
    </Button>
  );
}

type GatedNextButtonProps = Omit<NextButtonProps, "Button"> & {
  Button: FC<PropsWithChildren<NavButtonProps>>;
};

function GatedNextButton(props: GatedNextButtonProps) {
  const { Button, currentStep, stepsLength, setCurrentStep, steps } = props;
  const { isStepComplete, visitedMax } = useTourProgress();

  const hiddenPlaceholder = (
    <span aria-hidden className="invisible pointer-events-none">
      <Button onClick={() => undefined} kind="next" />
    </span>
  );

  const isLastStep = currentStep === stepsLength - 1;
  if (isLastStep) {
    return hiddenPlaceholder;
  }

  const step = steps?.[currentStep];
  if (!step) {
    return hiddenPlaceholder;
  }

  const isRevisit = currentStep < visitedMax;
  const advance = () =>
    setCurrentStep((s: number) => Math.min(s + 1, stepsLength - 1));

  const disabled = isChecklistStep(step) && !isStepComplete(currentStep);

  if (isRevisit) {
    return <Button onClick={advance} kind="next" disabled={disabled} />;
  }

  return (
    <Button onClick={advance} kind="next" hideArrow disabled={disabled}>
      Next
    </Button>
  );
}

export function renderNextButton(props: GatedNextButtonProps) {
  return <GatedNextButton {...props} />;
}

type ComponentsProp = NonNullable<ProviderProps["components"]>;
type NavigationProps = React.ComponentProps<
  NonNullable<ComponentsProp["Navigation"]>
>;

type ChecklistStep = StepType & TourAction;

function isChecklistStep(step: StepType | undefined): step is ChecklistStep {
  return (
    step != null &&
    "interaction" in step &&
    typeof step.interaction === "string" &&
    step.interaction.length > 0
  );
}

export function TourStepChecklist({
  step,
  stepIndex,
}: {
  step: StepType | undefined;
  stepIndex: number;
}) {
  const { isStepComplete } = useTourProgress();
  if (!isChecklistStep(step)) return null;

  const complete = isStepComplete(stepIndex);
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="rounded-md bg-muted px-3 py-2"
    >
      <Icon
        key={complete ? "complete" : "pending"}
        name={complete ? "CircleCheck" : "Circle"}
        size="sm"
        className={cn(
          "transition-colors",
          complete
            ? "text-green-600 animate-in zoom-in-50 duration-300"
            : "text-muted-foreground",
        )}
      />
      <Text
        size="sm"
        tone={complete ? "subdued" : undefined}
        className={cn("transition-colors", complete && "line-through")}
      >
        {renderInline(tourActionLabel(step))}
      </Text>
    </InlineStack>
  );
}

export function TourNavigation(props: NavigationProps) {
  const {
    setCurrentStep,
    currentStep,
    steps,
    nextButton,
    prevButton,
    setIsOpen,
    hideButtons,
    hideDots,
    disableAll,
    rtl,
  } = props;

  const stepsLength = steps.length;

  const { visitedMax: visited, recordVisited } = useTourProgress();

  useEffect(() => {
    recordVisited(currentStep);
  }, [recordVisited, currentStep]);

  const navButtonContext: NavButtonContext = {
    currentStep,
    stepsLength,
    setCurrentStep,
    disableAll,
    rtl,
  };

  const btnCtx = {
    Button: BoundNavButton,
    setCurrentStep,
    currentStep,
    stepsLength,
    setIsOpen,
    steps,
  };

  const renderPrev: ReactNode = !hideButtons ? (
    typeof prevButton === "function" ? (
      prevButton(btnCtx)
    ) : (
      <BoundNavButton kind="prev" />
    )
  ) : null;

  const renderNext: ReactNode = !hideButtons ? (
    typeof nextButton === "function" ? (
      nextButton(btnCtx)
    ) : (
      <BoundNavButton kind="next" />
    )
  ) : null;

  return (
    <NavButtonContext.Provider value={navButtonContext}>
      <BlockStack gap="3" align="stretch" className="mt-6">
        <TourStepChecklist step={steps[currentStep]} stepIndex={currentStep} />
        <div
          dir={rtl ? "rtl" : "ltr"}
          className="flex flex-row items-center justify-between"
        >
          {renderPrev}
          {!hideDots ? (
            <div
              aria-hidden
              className="flex flex-row items-center justify-between flex-nowrap"
            >
              {Array.from({ length: stepsLength }, (_, i) => i).map((index) => {
                const isCurrent = index === currentStep;
                const isVisited = index <= visited && !isCurrent;
                return (
                  <Badge
                    key={`tour-dot-${index}`}
                    variant="dot"
                    className={cn(
                      "m-1 transition-all",
                      isCurrent && "text-blue-500 scale-125",
                      isVisited && "text-blue-300",
                      !isCurrent && !isVisited && "text-zinc-300",
                    )}
                  />
                );
              })}
            </div>
          ) : null}
          {renderNext}
        </div>
      </BlockStack>
    </NavButtonContext.Provider>
  );
}

const AUTO_ADVANCE_DELAY_MS = 800;

export function TourAutoAdvance() {
  const { isOpen, currentStep, steps, setCurrentStep } = useTour();
  const { completedSteps, isStepComplete } = useTourProgress();

  const armedStepRef = useRef<number | null>(null);
  const visitedStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      visitedStepRef.current = null;
      armedStepRef.current = null;
      return undefined;
    }

    // On arrival at a step, auto-advance only if it isn't already complete.
    if (visitedStepRef.current !== currentStep) {
      visitedStepRef.current = currentStep;
      armedStepRef.current = isStepComplete(currentStep) ? null : currentStep;
    }

    const isLastStep = currentStep >= steps.length - 1;
    if (
      armedStepRef.current !== currentStep ||
      !isStepComplete(currentStep) ||
      isLastStep
    ) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setCurrentStep((s: number) => Math.min(s + 1, steps.length - 1));
    }, AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    currentStep,
    completedSteps,
    isStepComplete,
    steps,
    setCurrentStep,
  ]);

  return null;
}
