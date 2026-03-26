import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function FullscreenElement({
  children,
  fullscreen,
}: PropsWithChildren<{ fullscreen: boolean }>) {
  return (
    <div
      data-testid="fullscreen-container"
      className={cn(
        fullscreen
          ? "fixed top-0 left-0 z-2147483647 w-full h-full overflow-hidden pointer-events-auto"
          : "contents pointer-events-auto",
      )}
    >
      {children}
    </div>
  );
}
