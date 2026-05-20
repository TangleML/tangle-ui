import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * Toolbar — Layer 3 semantic primitive.
 *
 * Horizontal bar of action controls. Encodes the recurring
 * `InlineStack gap-1 shrink-0 px-* py-*` chrome (~14 hits across v2).
 */

const toolbarVariants = cva("shrink-0 w-full", {
  variants: {
    density: {
      compact: "px-1 py-0.5",
      cozy: "px-2 py-1",
      comfortable: "px-3 py-2",
    },
    chrome: {
      none: "",
      light: "bg-background border-b border-border",
      dark: "bg-stone-800 text-white",
      muted: "bg-muted/40",
    },
    sticky: {
      true: "sticky top-0 z-10",
      false: "",
    },
  },
  defaultVariants: {
    density: "cozy",
    chrome: "none",
    sticky: false,
  },
});

type ToolbarVariantProps = VariantProps<typeof toolbarVariants>;

interface ToolbarProps extends ToolbarVariantProps {
  as?: "div" | "header" | "footer" | "nav";
  /** Inter-action gap. @default '1' */
  gap?: "0" | "0.5" | "1" | "1.5" | "2" | "3" | "4" | "5" | "6" | "8";
  /** Distribution of toolbar items. @default 'start' */
  align?: "start" | "center" | "end" | "space-between";
  /** ARIA role override; defaults to 'toolbar'. */
  role?: string;
  /** ARIA label for the toolbar (recommended). */
  "aria-label"?: string;
}

export const Toolbar = forwardRef<HTMLElement, PropsWithChildren<ToolbarProps>>(
  function Toolbar(
    {
      children,
      as: Element = "div",
      density = "cozy",
      chrome = "none",
      sticky = false,
      gap = "1",
      align = "start",
      role = "toolbar",
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    return (
      <Element
        ref={ref as Ref<any>}
        role={role}
        aria-label={ariaLabel}
        className={cn(toolbarVariants({ density, chrome, sticky }))}
      >
        <InlineStack gap={gap} wrap="nowrap" blockAlign="center" align={align}>
          {children}
        </InlineStack>
      </Element>
    );
  },
);

Toolbar.displayName = "Toolbar";
