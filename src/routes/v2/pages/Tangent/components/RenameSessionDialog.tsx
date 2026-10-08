import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

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
  const [name, setName] = useState(session.name ?? "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    track("projects.rename_session_dialog_impression");
  }, [track]);

  const trimmedName = name.trim();
  const nameError = trimmedName === "" ? "Name cannot be empty" : undefined;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (nameError || isSaving) return;

    if (trimmedName === session.name) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onRename(session.resourceId, trimmedName);
      track("projects.rename_session_completed");
      notify("Session renamed", "success");
      onClose();
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename session</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="rename-session-name">Name</Label>
              <Input
                id="rename-session-name"
                value={name}
                placeholder={currentLabel}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={submitAttempted && nameError !== undefined}
                autoFocus
              />
              {submitAttempted && nameError && (
                <FieldMessage icon="CircleAlert" tone="critical">
                  {nameError}
                </FieldMessage>
              )}
            </BlockStack>

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  {...tracking("projects.rename_session_cancel")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  {...tracking("projects.rename_session_submit")}
                >
                  Rename
                </Button>
              </InlineStack>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
