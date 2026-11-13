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

/**
 * For a tab strip that scrolls sideways when its tabs outgrow it. `overflow-x`
 * alone computes `overflow-y` to `auto` as well, and the horizontal scrollbar
 * then eats into the strip's fixed height, leaving the tabs scrollable up and
 * down inside a bar one tab tall.
 */
export const SCROLLING_TAB_STRIP = "overflow-x-auto overflow-y-hidden";

/**
 * `default` is a segmented control for switching views of one thing. `line` is
 * a strip of document tabs (an underline marks the open one) for many open
 * things side by side, like chat threads or files. Its divider is an inset
 * shadow with the tabs lifted 1px clear of it, so the open tab's underline
 * rests on an unbroken line instead of half over it. It is as tall as a docked
 * window's header so the two line up, and inset from its edges so the first
 * tab's underline never runs into a neighbouring column's border.
 */
const tabsListVariants = cva("text-muted-foreground inline-flex w-fit", {
  variants: {
    variant: {
      default: "bg-muted h-9 items-center justify-center rounded-lg p-0.75",
      line: "h-10 items-stretch gap-1 px-2 pb-px shadow-[inset_0_-1px_0_var(--border)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const tabsTriggerVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "data-[state=active]:bg-background dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 transition-[color,box-shadow] data-[state=active]:shadow-sm",
        line: "text-muted-foreground hover:text-foreground hover:bg-accent/50 data-[state=active]:text-foreground data-[state=active]:border-b-foreground rounded-t-md border-b-2 border-transparent px-3 transition-colors",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TabsVariant = NonNullable<
  VariantProps<typeof tabsListVariants>["variant"]
>;

const TabsVariantContext = React.createContext<TabsVariant>("default");

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const resolvedVariant = variant ?? "default";
  return (
    <TabsVariantContext.Provider value={resolvedVariant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={resolvedVariant}
        className={cn(
          tabsListVariants({ variant: resolvedVariant }),
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
