import { Link as RouterLink } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import logo from "/Tangle_Icon_White.png";
import { InlineStack } from "@/components/ui/layout";
import { APP_ROUTES } from "@/routes/appRoutes";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

export function CanvasMenuBar({ children }: PropsWithChildren) {
  return (
    <header
      className="relative w-full shrink-0 bg-stone-900 px-3 py-1 md:px-4"
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

export function CanvasHomeLink({ trackingId }: { trackingId: string }) {
  return (
    <RouterLink
      to={APP_ROUTES.HOME}
      aria-label="Home"
      className="shrink-0"
      {...tracking(trackingId)}
    >
      <img src={logo} alt="logo" className="h-8 cursor-pointer shrink-0" />
    </RouterLink>
  );
}
