import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InlineStack } from "@/components/ui/layout";
import type { ConfirmPayload, ConfirmResult } from "@/config/preSubmitHooks";

interface ConfirmDialogContentProps {
  payload: ConfirmPayload;
  onResolve: (result: ConfirmResult) => void;
}

export function ConfirmDialogContent({
  payload,
  onResolve,
}: ConfirmDialogContentProps) {
  const [dismissForever, setDismissForever] = useState(false);

  const handleConfirm = () => {
    if (payload.dismissForeverKey && dismissForever) {
      try {
        localStorage.setItem(payload.dismissForeverKey, "true");
      } catch {
        // Ignore storage restriction errors.
      }
    }
    onResolve({ confirmed: true, dismissForever });
  };

  const handleCancel = () => {
    onResolve({ confirmed: false, dismissForever: false });
  };

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{payload.title}</AlertDialogTitle>
          <AlertDialogDescription>{payload.body}</AlertDialogDescription>
        </AlertDialogHeader>

        {payload.dismissForeverKey && (
          <InlineStack gap="2" blockAlign="center">
            <Checkbox
              id="confirm-dialog-dismiss-forever"
              checked={dismissForever}
              onCheckedChange={(checked) => setDismissForever(checked === true)}
            />
            <Label htmlFor="confirm-dialog-dismiss-forever">
              Don&apos;t show this again
            </Label>
          </InlineStack>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {payload.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {payload.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
