import { type ProviderProps, useTour } from "@reactour/tour";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import { APP_ROUTES } from "@/routes/router";

import { finishingSignal } from "./finishingSignal";

// Keep the popover at least this many pixels away from every viewport edge.
// Matches the badge's outside offset (≈13px) plus a small safety margin so
// the step-number chip in the top-left of the popover never gets clipped.
const POPOVER_VIEWPORT_MARGIN = 16;

export const POPOVER_STYLES = {
  popover: (base: object) => ({
    ...base,
    borderRadius: "0.75rem",
    padding: "1.25rem",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    maxWidth: "360px",
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

/**
 * Default popover placement: bottom of the target, except when the target
 * is a full-height strip flush against the right edge (e.g. a dock). In
 * that case, anchor the popover to the left of the target so it doesn't
 * spill off-screen.
 */
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

function FinishButton({ setIsOpen }: Pick<NextButtonProps, "setIsOpen">) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "8px 12px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#1f2937",
      }}
      onClick={() => {
        finishingSignal.mark();
        setIsOpen(false);
        navigate({ to: APP_ROUTES.LEARN_TOURS });
      }}
    >
      Finish
    </button>
  );
}

export function renderNextButton(props: NextButtonProps) {
  const { Button, currentStep, stepsLength, setCurrentStep, setIsOpen, steps } =
    props;
  const isLastStep = currentStep === stepsLength - 1;
  if (isLastStep) {
    return <FinishButton setIsOpen={setIsOpen} />;
  }
  // Hide the Next arrow on interactive steps — the user advances by
  // completing the prompted action (clicking a task, undocking a window,
  // etc.). Lets us keep tour state in sync with editor state.
  const step = steps?.[currentStep] as TourStep | undefined;
  if (step?.interaction) {
    return null;
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

/**
 * Reactour applies the popover's position via `transform: translate(x, y)` on
 * an inline style. When the highlight is near a viewport edge the popover
 * snaps flush against the edge — which clips our step-number badge that
 * sits ≈13px outside the popover's top-left corner. Reactour exposes no
 * "viewport padding" knob, so we watch the popover's inline style and clamp
 * its translate to stay `POPOVER_VIEWPORT_MARGIN` away from every edge.
 */
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
