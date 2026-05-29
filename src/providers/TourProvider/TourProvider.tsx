import { TourProvider as ReactourProvider } from "@reactour/tour";
import type { ReactNode } from "react";

import {
  computeDefaultPopoverPosition,
  POPOVER_STYLES,
  PopoverClampBridge,
  renderNextButton,
  TourNavigation,
} from "./TourPopover";

export function TourProvider({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </ReactourProvider>
  );
}
