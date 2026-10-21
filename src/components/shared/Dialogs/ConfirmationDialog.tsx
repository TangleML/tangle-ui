import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InlineStack } from "@/components/ui/layout";

type ConfirmationDialogProps = {
  title?: string;
  description?: string;
  content?: ReactNode;
  confirmLabel?: string;
  dismissForeverKey?: string;
  dismissForeverLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
} & (
  | { trigger: ReactNode; isOpen?: boolean }
  | { trigger?: ReactNode; isOpen: boolean }
);

const defaultTitle = "Are you sure?";
const defaultDescription = "This action cannot be undone.";

const ConfirmationDialog = ({
  trigger,
  title = defaultTitle,
  description = defaultDescription,
  content,
  confirmLabel = "Continue",
  dismissForeverKey,
  dismissForeverLabel = "Don't show this again",
  isOpen,
  onConfirm,
  onCancel = () => {},
}: ConfirmationDialogProps) => {
  const [dismissForever, setDismissForever] = useState(false);
  const checkboxId = useId();

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setDismissForever(false);
      if (!dismissForeverKey) return;
      try {
        if (localStorage.getItem(dismissForeverKey) !== "true") return;
      } catch {
        return;
      }
      e.preventDefault();
      onConfirm();
    },
    [dismissForeverKey, onConfirm],
  );

  const handleConfirm = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (dismissForeverKey && dismissForever) {
        try {
          localStorage.setItem(dismissForeverKey, "true");
        } catch {
          // Confirmation still works when browser storage is unavailable.
        }
      }
      onConfirm();
    },
    [dismissForeverKey, dismissForever, onConfirm],
  );

  const handleCancel = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onCancel();
    },
    [onCancel],
  );

  return (
    <AlertDialog open={isOpen}>
      {trigger && (
        <AlertDialogTrigger
          className="cursor-pointer"
          onClick={handleClick}
          asChild
        >
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {content}
        {dismissForeverKey && (
          <InlineStack gap="2" blockAlign="center">
            <Checkbox
              id={checkboxId}
              checked={dismissForever}
              onCheckedChange={(checked) => setDismissForever(checked === true)}
            />
            <Label htmlFor={checkboxId}>{dismissForeverLabel}</Label>
          </InlineStack>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} autoFocus>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
