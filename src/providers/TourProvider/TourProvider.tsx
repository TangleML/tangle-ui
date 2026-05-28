import { TourProvider as ReactourProvider } from "@reactour/tour";
import type { ReactNode } from "react";

import {
  renderNextButton,
  TourAutoAdvance,
  TourNavigation,
} from "./TourNavigation";
import {
  computeDefaultPopoverPosition,
  POPOVER_STYLES,
  PopoverClampBridge,
} from "./TourPopover";
import { TourProgressProvider } from "./TourProgressContext";
import { TourSaveExploreProvider } from "./TourSaveExploreContext";

export function TourProvider({ children }: { children: ReactNode }) {
  return (
    <TourProgressProvider>
      <TourSaveExploreProvider>
        <ReactourProvider
          steps={[]}
          styles={POPOVER_STYLES}
          components={{ Navigation: TourNavigation }}
          scrollSmooth
          showBadge
          showCloseButton={false}
          showNavigation
          showPrevNextButtons
          disableKeyboardNavigation={["esc"]}
          padding={{ mask: 0, popover: 10 }}
          position={computeDefaultPopoverPosition}
          nextButton={renderNextButton}
          onClickMask={() => undefined}
        >
          <PopoverClampBridge />
          <TourAutoAdvance />
          {children}
        </ReactourProvider>
      </TourSaveExploreProvider>
    </TourProgressProvider>
  );
}
