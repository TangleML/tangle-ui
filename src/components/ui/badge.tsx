import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      size: {
        xs: "text-xs p-0.5 w-4 h-4",
        sm: "text-xs",
        md: "text-sm",
      },
      position: {
        inline: "inline-flex",
        block: "block",
        topright: "absolute -top-1 -right-1",
        topleft: "absolute -top-2 -left-2",
      },
      shape: {
        rectangle: "rounded-md",
        rounded: "rounded-full",
      },
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        inform: "bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        dot: "w-2 h-2 p-0 border-0 rounded-full bg-current",
      },
    },
    defaultVariants: {
      shape: "rectangle",
      variant: "default",
      position: "inline",
      size: "md",
    },
  },
);

function Badge({
  className,
  variant,
  position,
  shape,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, position, size, shape }),
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
