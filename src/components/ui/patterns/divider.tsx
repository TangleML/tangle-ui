import { cva, type VariantProps } from "class-variance-authority";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Divider — Layer 3 semantic primitive.
 *
 * Thin wrapper over Separator with `inset` and `orientation` semantics
 * (covers the `mx-0.5 self-stretch` toolbar-divider pattern).
 */

const dividerVariants = cva("", {
  variants: {
    inset: {
      none: "",
      sm: "mx-1",
      md: "mx-2",
    },
    orientation: {
      vertical: "self-stretch",
      horizontal: "w-full",
    },
  },
  defaultVariants: {
    inset: "none",
    orientation: "vertical",
  },
});

type DividerVariantProps = VariantProps<typeof dividerVariants>;

interface DividerProps extends DividerVariantProps {
  decorative?: boolean;
}

export function Divider({
  inset = "none",
  orientation = "vertical",
  decorative = true,
}: DividerProps) {
  return (
    <Separator
      orientation={orientation ?? "vertical"}
      decorative={decorative}
      className={cn(dividerVariants({ inset, orientation }))}
    />
  );
}

Divider.displayName = "Divider";
