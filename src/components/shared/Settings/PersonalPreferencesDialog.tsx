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
import { Switch } from "@/components/ui/switch";

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

        <div className="flex flex-col gap-4">
          <p className="font-semibold">Beta Features</p>
          {betaFlags.map((flag) => (
            <div key={flag.name} className="flex items-center gap-2">
              <Switch
                checked={flag.enabled}
                onCheckedChange={(checked) => handleSetFlag(flag.key, checked)}
                data-testid={`${flag.key}-switch`}
              />
              <div className="flex flex-col items-start">
                <span>{flag.name}</span>
                <p className="text-sm text-muted-foreground">
                  {flag.description}
                </p>
              </div>
            </div>
          ))}
        </div>
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
