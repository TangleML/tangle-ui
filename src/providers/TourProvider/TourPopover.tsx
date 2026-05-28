import { useTour } from "@reactour/tour";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { setTourActive } from "@/utils/tourActive";
import { tracking } from "@/utils/tracking";

import { useTourProgress } from "./TourProgressContext";
import { useTourSaveExplore } from "./TourSaveExploreContext";

// Matches the step-number badge's ≈13px outside offset plus a small margin.
const POPOVER_VIEWPORT_MARGIN = 16;
// Popover padding (40) + prev icon button (~32) + "Next" text button (~60) + buffer.
const POPOVER_NAV_BASE_WIDTH = 140;
const POPOVER_DOT_WIDTH = 16;
const POPOVER_DEFAULT_MAX_WIDTH = 420;

export const POPOVER_STYLES = {
  popover: (base: object) => ({
    ...base,
    borderRadius: "0.75rem",
    padding: "1.25rem",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    maxWidth: `${POPOVER_DEFAULT_MAX_WIDTH}px`,
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
  "top" | "right" | "bottom" | "left" | "center" | [number, number];

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

export function TourCompletionActions() {
  const navigate = useNavigate();
  const { setIsOpen } = useTour();
  const { available, setOpen } = useTourSaveExplore();

  const onDone = () => {
    setIsOpen(false);
    void navigate({ to: APP_ROUTES.LEARN_TOURS });
  };

  const onSavePipeline = () => {
    setIsOpen(false);
    setOpen(true);
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
      {available && (
        <BlockStack align="center">
          <Text size="xs" tone="subdued">
            Continue exploring:
          </Text>
          <Button
            size="xs"
            variant="link"
            onClick={onSavePipeline}
            {...tracking("v2.pipeline_editor.tour.save_as_pipeline")}
          >
            <Icon name="SaveAll" size="xs" />
            Save demo pipeline
          </Button>
        </BlockStack>
      )}
    </BlockStack>
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
  const { isOpen, steps } = useTour();
  const { reset: resetTourProgress } = useTourProgress();
  const stepCount = steps?.length ?? 0;

  useEffect(() => {
    if (isOpen) {
      resetTourProgress();
    }
  }, [isOpen, resetTourProgress]);

  // Expose tour-open state to non-React callers (e.g. dispatchResizeOnToggle)
  // so app-wide popover/dropdown side effects can no-op outside tours.
  useEffect(() => {
    setTourActive(isOpen);
    return () => setTourActive(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let styleObserver: MutationObserver | null = null;
    let findObserver: MutationObserver | null = null;

    const applyMinWidth = (el: HTMLElement) => {
      const required = POPOVER_NAV_BASE_WIDTH + stepCount * POPOVER_DOT_WIDTH;
      const width = Math.max(POPOVER_DEFAULT_MAX_WIDTH, required);
      el.style.minWidth = `${width}px`;
      el.style.maxWidth = `${width}px`;
    };

    const observe = (el: HTMLElement) => {
      applyMinWidth(el);
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
  }, [isOpen, stepCount]);

  return null;
}
