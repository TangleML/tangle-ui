import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const skeletonVariants = cva("bg-accent animate-pulse rounded-md", {
  variants: {
    color: {
      default: "bg-accent",
      dark: "bg-gray-200",
    },
    /**
     * Legacy size (preserved for backward compat during migration).
     * Prefer `shape` + `width`.
     */
    size: {
      sm: "h-4 w-24",
      lg: "h-4 w-32",
      full: "h-4 w-full",
      half: "h-4 w-1/2",
    },
    shape: {
      // Legacy shapes (kept for compat)
      square: "rounded-md",
      circle: "rounded-full",
      button: "rounded-md h-8",
      // New semantic shapes
      line: "h-4 rounded-sm",
      block: "h-8 rounded-md",
      panel: "min-h-32 flex-1 rounded-md",
      avatar: "h-10 w-10 rounded-full",
    },
    width: {
      none: "",
      xs: "w-12",
      sm: "w-24",
      md: "w-32",
      lg: "w-48",
      xl: "w-64",
      "2xl": "w-96",
      half: "w-1/2",
      full: "w-full",
    },
  },
});

interface SkeletonProps
  extends
    Omit<React.ComponentProps<"div">, "color">,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({
  className,
  size,
  shape = "square",
  color = "default",
  width,
  ...props
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ size, shape, color, width }), className)}
      {...props}
    />
  );
}

export { Skeleton };
