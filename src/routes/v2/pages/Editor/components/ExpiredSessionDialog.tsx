import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { exportCurrentPipeline } from "./EditorMenuBar/components/fileMenu.actions";

/**
 * Signing in again means reloading, and reloading throws away edits the store
 * never took — so the way out is offered before the reload rather than after
 * it. Nothing is dismissable here on purpose: every further edit made in this
 * tab is one more thing the export has to carry.
 */
export const ExpiredSessionDialog = observer(function ExpiredSessionDialog() {
  const { autoSave } = useEditorSession();
  const { navigation } = useSharedStores();

  if (!autoSave.sessionExpired) return null;

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} data-testid="expired-session">
        <DialogHeader>
          <DialogTitle>Your session has expired</DialogTitle>
          <DialogDescription>
            {autoSave.saveError} Save a copy first: reloading discards anything
            that has not been stored.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => exportCurrentPipeline(navigation)}
          >
            Download a copy
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
