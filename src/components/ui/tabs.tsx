import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-0.75 shrink-0",
  {
    variants: {
      fullWidth: {
        true: "w-full",
        false: "w-fit",
      },
      gutter: {
        none: "",
        compact: "mx-2 mt-1",
        cozy: "mx-3 mt-2",
        comfortable: "mx-4 mt-3",
      },
    },
    defaultVariants: {
      fullWidth: false,
      gutter: "none",
    },
  },
);

interface TabsListProps
  extends
    React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

function TabsList({ className, fullWidth, gutter, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-fullwidth={fullWidth ? "true" : undefined}
      className={cn(tabsListVariants({ fullWidth, gutter }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

const tabsContentVariants = cva("outline-none", {
  variants: {
    layout: {
      // Default: only grow within the tabs flex column.
      flow: "flex-1",
      // Fills available height; common for tabs that own a vertical layout below.
      fill: "flex-1 min-h-0 flex flex-col",
      // Fills + adds y-scroll; common for content panes that scroll independently.
      scroll: "flex-1 min-h-0 overflow-y-auto",
    },
    flush: {
      // Remove the default top spacing emitted by Tabs root (`gap-2`).
      true: "mt-0",
      false: "",
    },
  },
  defaultVariants: {
    layout: "flow",
    flush: false,
  },
});

interface TabsContentProps
  extends
    React.ComponentProps<typeof TabsPrimitive.Content>,
    VariantProps<typeof tabsContentVariants> {}

function TabsContent({ className, layout, flush, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(tabsContentVariants({ layout, flush }), className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
