import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * ScrollRegion — Layer 3 semantic primitive.
 *
 * Encapsulates the recurring `flex-1 min-h-0 overflow-y-auto` pattern
 * (a flex-child that fills available space and scrolls its own content).
 *
 * Replaces 22+ raw className uses across v2.
 */

const scrollRegionVariants = cva("flex-1", {
  variants: {
    axis: {
      y: "min-h-0 overflow-y-auto overflow-x-hidden",
      x: "min-w-0 overflow-x-auto overflow-y-hidden",
      both: "min-h-0 min-w-0 overflow-auto",
    },
    scrollbar: {
      default: "",
      subtle: "subtle-scrollbar",
      hidden: "hide-scrollbar",
    },
    position: {
      static: "static",
      relative: "relative",
    },
    zIndex: {
      "0": "z-0",
      "10": "z-10",
      "20": "z-20",
      "30": "z-30",
    },
  },
  defaultVariants: {
    axis: "y",
    scrollbar: "default",
  },
});

type ScrollRegionVariantProps = VariantProps<typeof scrollRegionVariants>;

interface ScrollRegionProps extends ScrollRegionVariantProps {
  as?: "div" | "section" | "main" | "article";
  /** ARIA role override. */
  role?: string;
}

export const ScrollRegion = forwardRef<
  HTMLElement,
  PropsWithChildren<ScrollRegionProps>
>(function ScrollRegion(
  {
    children,
    axis = "y",
    scrollbar = "default",
    position,
    zIndex,
    as: Element = "div",
    role,
  },
  ref,
) {
  return (
    <Element
      ref={ref as Ref<any>}
      role={role}
      className={cn(scrollRegionVariants({ axis, scrollbar, position, zIndex }))}
    >
      {children}
    </Element>
  );
});

ScrollRegion.displayName = "ScrollRegion";
