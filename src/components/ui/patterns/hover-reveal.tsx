import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * HoverReveal — Layer 3 semantic primitive.
 *
 * Wrap actions that should appear on hover/focus of an enclosing `ListRow` or `group`.
 * Encodes the recurring `opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`
 * pattern (~14 hits across v2).
 *
 * Must live inside a Tailwind `group` parent (ListRow sets it automatically).
 */

const hoverRevealVariants = cva(
  "transition-opacity duration-150 motion-reduce:transition-none",
  {
    variants: {
      mode: {
        // Hidden by default, revealed on hover/focus.
        "on-hover":
          "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        // Always visible, dim by default, full opacity on hover/focus.
        "dim-until-hover":
          "opacity-60 group-hover:opacity-100 focus-within:opacity-100",
      },
      shrink: {
        true: "shrink-0",
        false: "",
      },
    },
    defaultVariants: {
      mode: "on-hover",
      shrink: true,
    },
  },
);

type HoverRevealVariantProps = VariantProps<typeof hoverRevealVariants>;

interface HoverRevealProps extends HoverRevealVariantProps {
  as?: "div" | "span";
}

export const HoverReveal = forwardRef<
  HTMLElement,
  PropsWithChildren<HoverRevealProps>
>(function HoverReveal(
  { children, mode = "on-hover", shrink = true, as: Element = "div" },
  ref,
) {
  return (
    <Element
      ref={ref as Ref<any>}
      className={cn(hoverRevealVariants({ mode, shrink }))}
    >
      {children}
    </Element>
  );
});

HoverReveal.displayName = "HoverReveal";
