import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * IconButton — Layer 3 semantic primitive.
 *
 * Square icon-only button. Replaces the recurring `<Button size="..." className="h-5 w-5 p-0">` +
 * `<Icon className="text-..." />` combo (~15 hits across v2).
 */

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 shrink-0 cursor-pointer",
  {
    variants: {
      size: {
        xs: "h-5 w-5",
        sm: "h-6 w-6",
        md: "h-7 w-7",
        lg: "h-9 w-9",
      },
      variant: {
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        solid: "bg-primary text-primary-foreground hover:bg-primary/90",
        subtle: "bg-muted hover:bg-muted/70",
        chrome: "text-stone-400 hover:text-white hover:bg-stone-700",
      },
      tone: {
        default: "",
        critical: "",
        warning: "",
        success: "",
      },
    },
    compoundVariants: [
      {
        variant: "ghost",
        tone: "critical",
        className:
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
      },
      {
        variant: "ghost",
        tone: "warning",
        className: "text-warning hover:bg-warning/10",
      },
      {
        variant: "ghost",
        tone: "success",
        className: "text-success hover:bg-success/10",
      },
      {
        variant: "outline",
        tone: "critical",
        className:
          "border-destructive text-destructive hover:bg-destructive/10",
      },
    ],
    defaultVariants: {
      size: "sm",
      variant: "ghost",
      tone: "default",
    },
  },
);

type IconButtonVariantProps = VariantProps<typeof iconButtonVariants>;

interface IconButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    IconButtonVariantProps {
  icon: IconName;
  /** ARIA label is required because there is no visible text. */
  "aria-label": string;
}

const iconSizeForButton = {
  xs: "xs",
  sm: "xs",
  md: "sm",
  lg: "md",
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      size = "sm",
      variant = "ghost",
      tone = "default",
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(iconButtonVariants({ size, variant, tone }))}
        {...rest}
      >
        <Icon name={icon} size={iconSizeForButton[size ?? "sm"]} />
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
