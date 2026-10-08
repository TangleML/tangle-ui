import { type FormEvent, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { tracking } from "@/utils/tracking";

interface RenameDialogProps {
  open: boolean;
  title: string;
  description: string;
  currentName: string;
  placeholder?: string;
  isSaving?: boolean;
  trackingPrefix: string;
  onRename: (name: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({
  open,
  title,
  description,
  currentName,
  placeholder,
  isSaving = false,
  trackingPrefix,
  onRename,
  onOpenChange,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { track } = useAnalytics();
  const fieldId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setSubmitAttempted(false);
  }, [open, currentName]);

  useEffect(() => {
    if (!open) return;
    track(`${trackingPrefix}_dialog_impression`);
  }, [open, track, trackingPrefix]);

  const trimmedName = name.trim();
  const nameError = trimmedName === "" ? "Name cannot be empty" : undefined;
  // Rename stays pressable while the name is empty, because pressing it is what
  // asks for the complaint. Revealing the complaint on blur instead grew the
  // dialog between mousedown and mouseup, which moved Cancel out from under the
  // pointer and swallowed the click.
  const showError = submitAttempted && nameError !== undefined;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (nameError || isSaving) return;

    if (trimmedName === currentName) {
      onOpenChange(false);
      return;
    }

    onRename(trimmedName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor={fieldId}>Name</Label>
              <Input
                id={fieldId}
                value={name}
                placeholder={placeholder}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={showError}
                aria-describedby={showError ? errorId : undefined}
                autoFocus
              />
              {showError && (
                <FieldMessage id={errorId} icon="CircleAlert" tone="critical">
                  {nameError}
                </FieldMessage>
              )}
            </BlockStack>

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  {...tracking(`${trackingPrefix}_cancel`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  {...tracking(`${trackingPrefix}_submit`)}
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
