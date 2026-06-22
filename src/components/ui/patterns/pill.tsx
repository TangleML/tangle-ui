import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * Pill — Layer 3 semantic primitive.
 *
 * Small chip/tag label, optionally interactive. Encodes the recurring
 * `text-xs rounded-md px-2 py-1 bg-black/5 hover:bg-black/10` pattern
 * used for TaskNode handle labels (~10 hits).
 */

const pillVariants = cva(
  "inline-flex items-center gap-1 truncate font-medium",
  {
    variants: {
      size: {
        xs: "text-xs px-1.5 py-0.5 rounded-sm",
        sm: "text-xs px-2 py-1 rounded-md",
        md: "text-sm px-2.5 py-1 rounded-md",
      },
      tone: {
        default: "bg-black/5 text-foreground",
        subdued: "bg-muted text-muted-foreground",
        critical: "bg-destructive/10 text-destructive",
        warning: "bg-warning/15 text-warning-foreground",
        info: "bg-info/10 text-info",
        success: "bg-success/10 text-success",
        magic: "bg-accent text-accent-foreground",
      },
      hoverable: {
        true: "cursor-pointer hover:opacity-90",
        false: "",
      },
      muted: {
        true: "opacity-50 italic",
        false: "",
      },
    },
    defaultVariants: {
      size: "sm",
      tone: "default",
      hoverable: false,
      muted: false,
    },
  },
);

type PillVariantProps = VariantProps<typeof pillVariants>;

interface PillProps extends PillVariantProps {
  as?: "span" | "div" | "button";
  title?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export const Pill = forwardRef<HTMLElement, PropsWithChildren<PillProps>>(
  function Pill(
    {
      children,
      size = "sm",
      tone = "default",
      hoverable = false,
      muted = false,
      as: Element = "span",
      title,
      onClick,
    },
    ref,
  ) {
    const isInteractive = hoverable || onClick != null;
    return (
      <Element
        ref={ref as Ref<any>}
        title={title}
        onClick={onClick}
        className={cn(
          pillVariants({ size, tone, hoverable: isInteractive, muted }),
        )}
      >
        {children}
      </Element>
    );
  },
);

Pill.displayName = "Pill";
