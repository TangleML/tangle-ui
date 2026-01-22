import { Settings } from "lucide-react";
import { useState } from "react";

import { ExistingBetaFlags } from "@/betaFlags";

import TooltipButton from "../Buttons/TooltipButton";
import { PersonalPreferencesDialog } from "./PersonalPreferencesDialog";

export function PersonalPreferences() {
  const [open, setOpen] = useState(false);

  if (Object.keys(ExistingBetaFlags).length === 0) {
    return null;
  }

  return (
    <>
      <TooltipButton
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/10"
        tooltip="Personal Preferences"
        onClick={() => setOpen(true)}
        data-testid="personal-preferences-button"
      >
        <Settings className="h-4 w-4" />
      </TooltipButton>
      <PersonalPreferencesDialog open={open} setOpen={setOpen} />
    </>
  );
}
