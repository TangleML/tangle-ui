import { type ProviderProps, useTour } from "@reactour/tour";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { APP_ROUTES } from "@/routes/router";
import { tracking } from "@/utils/tracking";

// Matches the step-number badge's ≈13px outside offset plus a small margin.
const POPOVER_VIEWPORT_MARGIN = 16;

export const POPOVER_STYLES = {
  popover: (base: object) => ({
    ...base,
    borderRadius: "0.75rem",
    padding: "1.25rem",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    maxWidth: "420px",
  }),
  maskWrapper: (base: object) => ({
    ...base,
    color: "rgba(15, 23, 42, 0.5)",
  }),
  maskArea: (base: object) => ({
    ...base,
    rx: 6,
  }),
  highlightedArea: (
    base: object,
    state?: { width?: number; height?: number },
  ) => ({
    ...base,
    display:
      state?.width && state?.height ? ("block" as const) : ("none" as const),
    fill: "transparent",
    stroke: "#60a5fa",
    strokeWidth: 2,
    rx: 6,
    pointerEvents: "none" as const,
  }),
  badge: (base: object) => ({
    ...base,
    background: "#0f172a",
    color: "white",
    fontSize: "0.75rem",
  }),
};

interface PositionProps {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  windowWidth: number;
  windowHeight: number;
}

type ResolvedPosition =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "center"
  | [number, number];

export function computeDefaultPopoverPosition(
  props: PositionProps,
): ResolvedPosition {
  const targetHeight = props.bottom - props.top;

  const isFullHeightRightStrip =
    props.right >= props.windowWidth - 4 &&
    targetHeight > props.windowHeight * 0.5;

  if (isFullHeightRightStrip) {
    const popoverWidth = props.width || 380;
    const margin = 16;
    return [
      Math.max(margin, props.left - popoverWidth - margin),
      Math.max(props.top + margin, 64),
    ];
  }

  return "bottom";
}

type NextButtonProps = Parameters<NonNullable<ProviderProps["nextButton"]>>[0];

export function TourCompletionActions() {
  const navigate = useNavigate();
  const { setIsOpen } = useTour();

  const onDone = () => {
    setIsOpen(false);
    void navigate({ to: APP_ROUTES.LEARN_TOURS });
  };

  return (
    <BlockStack gap="3" align="center">
      <Button
        size="sm"
        variant="outline"
        onClick={onDone}
        {...tracking("v2.pipeline_editor.tour.finish")}
      >
        <Icon name="Check" size="sm" />
        Finish Tour
      </Button>
    </BlockStack>
  );
}

export function renderNextButton(props: NextButtonProps) {
  const { Button, currentStep, stepsLength, setCurrentStep, steps } = props;

  const hiddenPlaceholder = (
    <span aria-hidden style={{ visibility: "hidden", pointerEvents: "none" }}>
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

  // Interaction steps advance via the prompted action, not a Next click.
  if ("interaction" in step && step.interaction) {
    return hiddenPlaceholder;
  }

  return (
    <Button
      onClick={() =>
        setCurrentStep((step: number) => Math.min(step + 1, stepsLength - 1))
      }
      kind="next"
    />
  );
}

const TRANSLATE_PATTERN = /translate\(([\d.-]+)px,\s*([\d.-]+)px\)/;

function clampPopoverElement(el: HTMLElement): void {
  const transform = el.style.transform;
  const match = TRANSLATE_PATTERN.exec(transform);
  if (!match) return;

  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const rect = el.getBoundingClientRect();
  const m = POPOVER_VIEWPORT_MARGIN;

  const maxX = Math.max(m, window.innerWidth - rect.width - m);
  const maxY = Math.max(m, window.innerHeight - rect.height - m);
  const clampedX = Math.min(Math.max(x, m), maxX);
  const clampedY = Math.min(Math.max(y, m), maxY);

  if (clampedX !== x || clampedY !== y) {
    el.style.transform = `translate(${Math.round(clampedX)}px, ${Math.round(clampedY)}px)`;
  }
}

// Reactour has no viewport-padding setting and lets the popover snap flush to
// edges, which clips our step-number badge. We observe its inline transform
// and clamp it to stay POPOVER_VIEWPORT_MARGIN inside the viewport.
export function PopoverClampBridge() {
  const { isOpen } = useTour();

  useEffect(() => {
    if (!isOpen) return undefined;

    let styleObserver: MutationObserver | null = null;
    let findObserver: MutationObserver | null = null;

    const observe = (el: HTMLElement) => {
      styleObserver = new MutationObserver(() => clampPopoverElement(el));
      styleObserver.observe(el, {
        attributes: true,
        attributeFilter: ["style"],
      });
      clampPopoverElement(el);
    };

    const existing = document.querySelector(".reactour__popover");
    if (existing instanceof HTMLElement) {
      observe(existing);
    } else {
      findObserver = new MutationObserver(() => {
        const el = document.querySelector(".reactour__popover");
        if (el instanceof HTMLElement) {
          findObserver?.disconnect();
          findObserver = null;
          observe(el);
        }
      });
      findObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      styleObserver?.disconnect();
      findObserver?.disconnect();
    };
  }, [isOpen]);

  return null;
}
