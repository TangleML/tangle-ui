import { cva, type VariantProps } from "class-variance-authority";
import { icons, type LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "!w-3 !h-3",
      sm: "!w-3.5 !h-3.5",
      md: "!w-4 !h-4",
      lg: "!w-5 !h-5",
      xl: "!w-6 !h-6",
      "2xl": "!w-8 !h-8",
      fill: "!w-full !h-full",
    },
    tone: {
      inherit: "",
      subdued: "text-muted-foreground",
      strong: "text-foreground",
      weak: "text-muted-foreground/60",
      critical: "text-destructive",
      warning: "text-warning",
      success: "text-success",
      info: "text-info",
      accent: "text-accent-foreground",
      magic: "text-accent-foreground",
    },
    rotate: {
      "0": "",
      "90": "rotate-90",
      "180": "rotate-180",
      "-90": "-rotate-90",
    },
    spin: {
      true: "animate-spin",
      false: "",
    },
    pulse: {
      true: "animate-pulse",
      false: "",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "inherit",
    spin: false,
    pulse: false,
  },
});

export type IconName = keyof typeof icons;
type IconVariantProps = VariantProps<typeof iconVariants>;

interface IconProps extends IconVariantProps {
  name: IconName;
  /**
   * Escape-hatch className. Kept for backward compatibility during the
   * ban-classname-on-primitives migration. Will be removed once the
   * `tangle-ui/no-classname-on-primitives` rule is promoted to `error`.
   * @deprecated Use semantic props (`tone`, `size`, `rotate`, `spin`, `pulse`) instead.
   */
  className?: string;
}

export const Icon = ({
  name: icon,
  size = "md",
  tone = "inherit",
  rotate,
  spin = false,
  pulse = false,
  className,
  ...lucideIconProps
}: IconProps & LucideProps) => {
  const Component = icons[icon];
  return (
    <Component
      className={cn(
        iconVariants({ size, tone, rotate, spin, pulse }),
        className,
      )}
      {...lucideIconProps}
    />
  );
};
