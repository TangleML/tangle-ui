import { cva, type VariantProps } from "class-variance-authority";
import type { AriaAttributes, AriaRole, PropsWithChildren, Ref } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Box — Layer 1 "configurable container" primitive (Tangle UI).
 *
 * Modeled on Shopify Polaris Box:
 * https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/box
 *
 * Token-only escape hatch. No `className`. No flex helpers (use BlockStack / InlineStack for layout).
 * Product code should prefer Layer-3 semantic primitives; an ESLint warning fires on Box imports
 * inside `src/routes/v2/**`. Layer-3 primitive implementations may use Box freely.
 */

type BoxElement =
  | "div"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "aside"
  | "main"
  | "nav";

const boxVariants = cva("", {
  variants: {
    background: {
      transparent: "",
      subdued: "bg-muted/50",
      base: "bg-background",
      strong: "bg-secondary",
      card: "bg-card",
      inverted: "bg-foreground text-background",
      "critical-subtle": "bg-destructive/10",
      "warning-subtle": "bg-warning/15",
      "info-subtle": "bg-info/10",
      "success-subtle": "bg-success/10",
    },
    padding: {
      none: "p-0",
      xs: "p-1",
      sm: "p-2",
      base: "p-3",
      lg: "p-4",
      xl: "p-6",
    },
    paddingBlock: {
      none: "py-0",
      xs: "py-1",
      sm: "py-2",
      base: "py-3",
      lg: "py-4",
      xl: "py-6",
    },
    paddingInline: {
      none: "px-0",
      xs: "px-1",
      sm: "px-2",
      base: "px-3",
      lg: "px-4",
      xl: "px-6",
    },
    paddingBlockStart: {
      none: "pt-0",
      xs: "pt-1",
      sm: "pt-2",
      base: "pt-3",
      lg: "pt-4",
      xl: "pt-6",
    },
    paddingBlockEnd: {
      none: "pb-0",
      xs: "pb-1",
      sm: "pb-2",
      base: "pb-3",
      lg: "pb-4",
      xl: "pb-6",
    },
    paddingInlineStart: {
      none: "ps-0",
      xs: "ps-1",
      sm: "ps-2",
      base: "ps-3",
      lg: "ps-4",
      xl: "ps-6",
    },
    paddingInlineEnd: {
      none: "pe-0",
      xs: "pe-1",
      sm: "pe-2",
      base: "pe-3",
      lg: "pe-4",
      xl: "pe-6",
    },
    borderRadius: {
      none: "rounded-none",
      xs: "rounded-xs",
      sm: "rounded-sm",
      base: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      full: "rounded-full",
    },
    border: {
      none: "border-0",
      sm: "border",
      base: "border-2",
    },
    borderColor: {
      base: "border-border",
      subdued: "border-border/50",
      strong: "border-foreground/30",
      critical: "border-destructive",
      warning: "border-warning",
      info: "border-info",
      success: "border-success",
    },
    shadow: {
      none: "shadow-none",
      xs: "shadow-xs",
      sm: "shadow-sm",
      md: "shadow-md",
      lg: "shadow-lg",
    },
    inlineSize: {
      auto: "w-auto",
      full: "w-full",
      fit: "w-fit",
      screen: "w-screen",
      "1/2": "w-1/2",
      "1/3": "w-1/3",
      "2/3": "w-2/3",
      "1/4": "w-1/4",
      "3/4": "w-3/4",
    },
    blockSize: {
      auto: "h-auto",
      full: "h-full",
      fit: "h-fit",
      screen: "h-screen",
    },
    minInlineSize: {
      "0": "min-w-0",
      auto: "min-w-auto",
      full: "min-w-full",
    },
    minBlockSize: {
      "0": "min-h-0",
      auto: "min-h-auto",
      full: "min-h-full",
      screen: "min-h-screen",
    },
    maxInlineSize: {
      none: "max-w-none",
      full: "max-w-full",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-xl",
      "2xl": "max-w-2xl",
      "5xl": "max-w-5xl",
      screen: "max-w-screen",
    },
    maxBlockSize: {
      none: "max-h-none",
      full: "max-h-full",
      screen: "max-h-screen",
      xs: "max-h-32",
      sm: "max-h-48",
      md: "max-h-64",
      lg: "max-h-80",
      xl: "max-h-96",
    },
    overflow: {
      visible: "overflow-visible",
      hidden: "overflow-hidden",
      auto: "overflow-auto",
      "scroll-y": "overflow-y-auto overflow-x-hidden",
      "scroll-x": "overflow-x-auto overflow-y-hidden",
      clip: "overflow-clip",
    },
    position: {
      static: "static",
      relative: "relative",
      absolute: "absolute",
      sticky: "sticky",
      fixed: "fixed",
    },
    zIndex: {
      "0": "z-0",
      "10": "z-10",
      "20": "z-20",
      "30": "z-30",
      "40": "z-40",
      "50": "z-50",
    },
  },
});

type BoxVariantProps = VariantProps<typeof boxVariants>;

interface BoxOwnProps extends AriaAttributes {
  /** HTML Element tag. @default 'div' */
  as?: BoxElement;
  /** ARIA role for assistive technologies. */
  role?: AriaRole;
  /** Native browser tooltip text. */
  title?: string;
  /** Inline event handler for click. */
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Pointer-events policy. */
  pointerEvents?: "auto" | "none";
}

export interface BoxProps extends BoxOwnProps, BoxVariantProps {}

export const Box = forwardRef<HTMLElement, PropsWithChildren<BoxProps>>(
  function Box(
    {
      as: Element = "div",
      children,
      background,
      padding,
      paddingBlock,
      paddingInline,
      paddingBlockStart,
      paddingBlockEnd,
      paddingInlineStart,
      paddingInlineEnd,
      borderRadius,
      border,
      borderColor,
      shadow,
      inlineSize,
      blockSize,
      minInlineSize,
      minBlockSize,
      maxInlineSize,
      maxBlockSize,
      overflow,
      position,
      zIndex,
      pointerEvents,
      role,
      ...rest
    },
    ref,
  ) {
    return (
      <Element
        ref={ref as Ref<any>}
        role={role}
        className={cn(
          boxVariants({
            background,
            padding,
            paddingBlock,
            paddingInline,
            paddingBlockStart,
            paddingBlockEnd,
            paddingInlineStart,
            paddingInlineEnd,
            borderRadius,
            border,
            borderColor,
            shadow,
            inlineSize,
            blockSize,
            minInlineSize,
            minBlockSize,
            maxInlineSize,
            maxBlockSize,
            overflow,
            position,
            zIndex,
          }),
          pointerEvents === "none" && "pointer-events-none",
          pointerEvents === "auto" && "pointer-events-auto",
        )}
        {...rest}
      >
        {children}
      </Element>
    );
  },
);

Box.displayName = "Box";
