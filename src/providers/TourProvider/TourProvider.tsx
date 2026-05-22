import { TourProvider as ReactourProvider } from "@reactour/tour";
import type { ReactNode } from "react";

import { TourOrphanCleanup } from "./TourOrphanCleanup";
import {
  computeDefaultPopoverPosition,
  POPOVER_STYLES,
  PopoverClampBridge,
  renderNextButton,
} from "./tourPopover";

/**
 * Top-level reactour provider. Mounted in `RootLayout` so any descendant can
 * read the tour state via `@reactour/tour`'s `useTour()` hook. All tour
 * orchestration (mounting steps, syncing URL ↔ current step, lifecycle of
 * the temp pipeline) lives in the `/tour/$tourId` route — not here.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  return (
    <ReactourProvider
      steps={[]}
      styles={POPOVER_STYLES}
      scrollSmooth
      showBadge
      showCloseButton
      showNavigation
      showPrevNextButtons
      padding={{ mask: 0, popover: 10 }}
      position={computeDefaultPopoverPosition}
      nextButton={renderNextButton}
      onClickMask={() => undefined}
    >
      <PopoverClampBridge />
      <TourOrphanCleanup />
      {children}
    </ReactourProvider>
  );
}
