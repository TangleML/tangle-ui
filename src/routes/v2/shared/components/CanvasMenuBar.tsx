import { Link as RouterLink } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import logo from "/Tangle_Icon_White.png";
import wordmarkLogo from "/Tangle_white.png";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

export const CANVAS_MENU_SURFACE_CLASS = "bg-stone-900";

export function CanvasMenuBar({ children }: PropsWithChildren) {
  return (
    <header
      className={cn(
        "relative w-full shrink-0 px-3 py-1 md:px-4",
        CANVAS_MENU_SURFACE_CLASS,
      )}
      style={{ height: TOP_NAV_HEIGHT }}
    >
      <InlineStack
        align="space-between"
        blockAlign="stretch"
        wrap="nowrap"
        className="h-full"
      >
        {children}
      </InlineStack>
    </header>
  );
}

/** `wordmark` shows "tangle" beside the mark, for a bar with room to spare. */
export function CanvasHomeLink({
  trackingId,
  wordmark = false,
}: {
  trackingId: string;
  wordmark?: boolean;
}) {
  return (
    <RouterLink
      to={APP_ROUTES.HOME}
      aria-label="Home"
      className="shrink-0"
      {...tracking(trackingId)}
    >
      <img
        src={wordmark ? wordmarkLogo : logo}
        alt="logo"
        className="h-8 cursor-pointer shrink-0"
      />
    </RouterLink>
  );
}
