import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * StickyHeader — Layer 3 semantic primitive.
 *
 * `sticky top-0 z-* bg-*` header inside a ScrollRegion (~4 hits across v2).
 */

const stickyHeaderVariants = cva("sticky top-0 z-10", {
  variants: {
    background: {
      base: "bg-background",
      subdued: "bg-muted/95 backdrop-blur",
      card: "bg-card",
    },
    divider: {
      true: "border-b border-border",
      false: "",
    },
  },
  defaultVariants: {
    background: "base",
    divider: true,
  },
});

type StickyHeaderVariantProps = VariantProps<typeof stickyHeaderVariants>;

interface StickyHeaderProps extends StickyHeaderVariantProps {
  as?: "div" | "header";
}

export const StickyHeader = forwardRef<
  HTMLElement,
  PropsWithChildren<StickyHeaderProps>
>(function StickyHeader(
  { children, background = "base", divider = true, as: Element = "header" },
  ref,
) {
  return (
    <Element
      ref={ref as Ref<any>}
      className={cn(stickyHeaderVariants({ background, divider }))}
    >
      {children}
    </Element>
  );
});

StickyHeader.displayName = "StickyHeader";
