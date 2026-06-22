import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { SurfaceLevelProvider } from "@/components/ui/patterns/surface";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm",
  {
    variants: {
      density: {
        compact: "gap-2 py-2",
        cozy: "gap-3 py-3",
        comfortable: "gap-6 py-6",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  },
);

type CardVariantProps = VariantProps<typeof cardVariants>;

interface CardProps extends React.ComponentProps<"div">, CardVariantProps {}

function Card({ className, density, ...props }: CardProps) {
  return (
    // Card establishes Surface level 1, so nested <Surface> defaults to level 2.
    <SurfaceLevelProvider level={1}>
      <div
        data-slot="card"
        className={cn(cardVariants({ density }), className)}
        {...props}
      />
    </SurfaceLevelProvider>
  );
}

const cardHeaderVariants = cva("flex flex-col gap-1.5", {
  variants: {
    density: {
      compact: "px-2",
      cozy: "px-3",
      comfortable: "px-6",
    },
    divider: {
      true: "border-b pb-3",
      false: "",
    },
  },
  defaultVariants: {
    density: "comfortable",
    divider: false,
  },
});

interface CardHeaderProps
  extends
    React.ComponentProps<"div">,
    VariantProps<typeof cardHeaderVariants> {}

function CardHeader({
  className,
  density,
  divider,
  ...props
}: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(cardHeaderVariants({ density, divider }), className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

const cardContentVariants = cva("", {
  variants: {
    density: {
      compact: "px-2",
      cozy: "px-3",
      comfortable: "px-6",
    },
  },
  defaultVariants: {
    density: "comfortable",
  },
});

interface CardContentProps
  extends
    React.ComponentProps<"div">,
    VariantProps<typeof cardContentVariants> {}

function CardContent({ className, density, ...props }: CardContentProps) {
  return (
    <div
      data-slot="card-content"
      className={cn(cardContentVariants({ density }), className)}
      {...props}
    />
  );
}

const cardFooterVariants = cva("flex items-center", {
  variants: {
    density: {
      compact: "px-2",
      cozy: "px-3",
      comfortable: "px-6",
    },
  },
  defaultVariants: {
    density: "comfortable",
  },
});

interface CardFooterProps
  extends
    React.ComponentProps<"div">,
    VariantProps<typeof cardFooterVariants> {}

function CardFooter({ className, density, ...props }: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(cardFooterVariants({ density }), className)}
      {...props}
    />
  );
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
