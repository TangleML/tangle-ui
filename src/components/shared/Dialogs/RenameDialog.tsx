import { type FormEvent, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
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
import type { DialogProps } from "@/providers/DialogProvider/types";
import { tracking } from "@/utils/tracking";

export interface RenameDialogProps {
  title: string;
  description: string;
  currentName: string;
  placeholder?: string;
  trackingPrefix: string;
}

/**
 * Resolves the trimmed name that was typed, and cancels when it is the name the
 * subject already had. Saving belongs to the caller, which outlives the dialog.
 */
export function RenameDialog({
  close,
  cancel,
  title,
  description,
  currentName,
  placeholder,
  trackingPrefix,
}: DialogProps<string, RenameDialogProps>) {
  const [name, setName] = useState(currentName);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { track } = useAnalytics();
  const fieldId = useId();
  const errorId = useId();

  useEffect(() => {
    track(`${trackingPrefix}_dialog_impression`);
  }, [track, trackingPrefix]);

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
    if (nameError) return;

    if (trimmedName === currentName) {
      cancel();
      return;
    }

    close(trimmedName);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
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
                onClick={cancel}
                {...tracking(`${trackingPrefix}_cancel`)}
              >
                Cancel
              </Button>
              <Button type="submit" {...tracking(`${trackingPrefix}_submit`)}>
                Rename
              </Button>
            </InlineStack>
          </DialogFooter>
        </BlockStack>
      </form>
    </>
  );
}
