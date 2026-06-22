import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

const collapsibleContentVariants = cva("w-full", {
  variants: {
    density: {
      none: "",
      compact: "px-2 py-1",
      cozy: "px-3 py-2",
      comfortable: "px-4 py-3",
    },
  },
  defaultVariants: {
    density: "none",
  },
});

interface CollapsibleContentProps
  extends
    React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>,
    VariantProps<typeof collapsibleContentVariants> {}

function CollapsibleContent({
  className,
  density,
  ...props
}: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn(collapsibleContentVariants({ density }), className)}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
