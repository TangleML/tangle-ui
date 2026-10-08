import { useState } from "react";

import { RenameDialog } from "@/components/shared/Dialogs/RenameDialog";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";

interface RenamableSession {
  resourceId: string;
  name: string | null;
}

interface RenameSessionDialogProps {
  session: RenamableSession;
  currentLabel: string;
  onRename: (resourceId: string, name: string) => Promise<unknown>;
  onClose: () => void;
}

export function RenameSessionDialog({
  session,
  currentLabel,
  onRename,
  onClose,
}: RenameSessionDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const notify = useToastNotification();
  const { track } = useAnalytics();

  const rename = async (name: string) => {
    setIsSaving(true);
    try {
      await onRename(session.resourceId, name);
      track("projects.rename_session_completed");
      notify("Session renamed", "success");
      onClose();
    } catch {
      // The resource mutation reports its own failure, so saying anything here
      // would be a second toast for one rename. The dialog stays open on the
      // name that was typed.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RenameDialog
      open
      title="Rename session"
      description="Give this session a name of your own."
      currentName={session.name ?? ""}
      placeholder={currentLabel}
      isSaving={isSaving}
      trackingPrefix="projects.rename_session"
      onRename={(name) => void rename(name)}
      onOpenChange={(next) => !next && onClose()}
    />
  );
}
