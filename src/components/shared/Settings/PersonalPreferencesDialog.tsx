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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BetaFeatures } from "./BetaFeatures";
import { Settings } from "./Settings";
import { useBetaFlagsReducer } from "./useBetaFlagReducer";

interface PersonalPreferencesDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function PersonalPreferencesDialog({
  open,
  setOpen,
}: PersonalPreferencesDialogProps) {
  const [allFlags, dispatch] = useBetaFlagsReducer(ExistingBetaFlags);

  const handleSetFlag = (flag: string, enabled: boolean) => {
    dispatch({ type: "setFlag", payload: { key: flag, enabled } });
  };

  const betaFlags = Object.values(allFlags).filter(
    (flag) => flag.category === "beta",
  );
  const settings = Object.values(allFlags).filter(
    (flag) => flag.category === "setting",
  );

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

        <Tabs defaultValue="settings" className="w-full gap-4">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="betas">Beta Features</TabsTrigger>
          </TabsList>
          <TabsContent value="settings">
            <Settings settings={settings} onChange={handleSetFlag} />
          </TabsContent>
          <TabsContent value="betas">
            <BetaFeatures betaFlags={betaFlags} onChange={handleSetFlag} />
          </TabsContent>
        </Tabs>

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
