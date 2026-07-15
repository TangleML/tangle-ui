import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

interface WindowStickyHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Pins content to the top of a window's scroll region.
 *
 * A docked window wraps its content in its own height-bounded scroll box, so
 * the sticky container is that per-window box (not the dock column) and its top
 * already sits below the chrome header. Pinning at `top: 0` therefore keeps the
 * header flush with the top of the chat's scroll area. When floating, the
 * content likewise lives in a height-bounded scroll box, so a flex-sibling
 * header pins on its own and no sticky positioning is needed.
 */
export function WindowStickyHeader({
  children,
  className,
}: WindowStickyHeaderProps) {
  const ctx = useOptionalWindowContext();
  const isDocked = ctx?.model.isDocked ?? false;

  return (
    <div className={cn(className, isDocked && "sticky top-0 z-10 bg-white")}>
      {children}
    </div>
  );
}
