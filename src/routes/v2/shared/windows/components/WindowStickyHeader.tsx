import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { DOCKED_HEADER_HEIGHT } from "@/routes/v2/shared/windows/types";

interface WindowStickyHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Pins content to the top of a window's scroll region.
 *
 * When docked, the whole dock column scrolls as one and each window's chrome
 * header is sticky at `dockIndex * DOCKED_HEADER_HEIGHT`, so this must stick one
 * header-height lower to sit just below it. When floating, the content lives in
 * a height-bounded scroll box, so a flex-sibling header pins on its own and no
 * offset is needed.
 */
export function WindowStickyHeader({
  children,
  className,
}: WindowStickyHeaderProps) {
  const ctx = useOptionalWindowContext();
  const isDocked = ctx?.model.isDocked ?? false;
  const dockIndex = ctx?.dockIndex ?? 0;

  return (
    <div
      className={cn(className, isDocked && "sticky z-10 bg-white")}
      style={
        isDocked ? { top: (dockIndex + 1) * DOCKED_HEADER_HEIGHT } : undefined
      }
    >
      {children}
    </div>
  );
}
