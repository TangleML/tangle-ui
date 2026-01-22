import { ExistingBetaFlags } from "@/betaFlags";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

import { Setting } from "./Setting";
import { useBetaFlagsReducer } from "./useBetaFlagReducer";

interface PersonalPreferencesDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function PersonalPreferencesDialog({
  open,
  setOpen,
}: PersonalPreferencesDialogProps) {
  const [betaFlags, dispatch] = useBetaFlagsReducer(ExistingBetaFlags);

  const handleSetFlag = (flag: string, enabled: boolean) => {
    dispatch({ type: "setFlag", payload: { key: flag, enabled } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-2xl overflow-hidden"
        aria-label="Personal Preferences"
        data-testid="personal-preferences-dialog"
      >
        <DialogHeader>
          <DialogTitle>Personal Preferences</DialogTitle>
        </DialogHeader>

        <DialogDescription aria-label="Personal Preferences">
          Configure your personal preferences.
        </DialogDescription>

        <BlockStack gap="4">
          <Paragraph weight="semibold">Beta Features</Paragraph>
          {betaFlags.map((flag) => (
            <Setting
              key={flag.key}
              setting={flag}
              onChange={(enabled) => handleSetFlag(flag.key, enabled)}
            />
          ))}
        </BlockStack>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              data-testid="close-button"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
