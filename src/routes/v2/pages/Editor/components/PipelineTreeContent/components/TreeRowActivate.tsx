import { cva } from "class-variance-authority";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

type TreeRowActivateLayout = "rootStrip" | "subgraphStrip" | "leafRow";

const treeRowActivateVariants = cva(
  "flex items-start gap-1 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      layout: {
        rootStrip: "min-w-0 flex-1 px-2",
        subgraphStrip: "min-w-0 flex-1 ",
        leafRow: "group min-w-0 py-1.5 rounded-md cursor-pointer w-full",
      },
    },
  },
);

interface TreeRowActivateProps {
  children: ReactNode;
  layout: TreeRowActivateLayout;
  selected?: boolean;
  taskId?: string;
  className?: string;
  trackingId?: string;

  onActivate: () => void;
}

export function TreeRowActivate({
  children,
  layout,
  onActivate,
  selected,
  taskId,
  className,
  trackingId,
}: TreeRowActivateProps) {
  const { editor } = useSharedStores();

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      {...(trackingId ? tracking(trackingId) : {})}
      {...(taskId !== undefined
        ? {
            onMouseEnter: () => {
              editor.setHoveredEntity(taskId);
            },
            onMouseLeave: () => {
              editor.setHoveredEntity(null);
            },
          }
        : {})}
      className={cn(treeRowActivateVariants({ layout }), className)}
    >
      {children}
    </div>
  );
}
