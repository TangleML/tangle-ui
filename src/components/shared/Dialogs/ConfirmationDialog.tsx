import { type MouseEvent, type ReactNode, useCallback } from "react";

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

type ConfirmationDialogProps = {
  title?: string;
  description?: string;
  content?: ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  pending?: boolean;
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
  isOpen,
  onConfirm,
  onCancel = () => {},
  pending = false,
}: ConfirmationDialogProps) => {
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleConfirm = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onConfirm();
    },
    [onConfirm],
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
      <AlertDialogContent aria-busy={pending}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {content}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            autoFocus
            disabled={pending}
          >
            {pending ? "Working..." : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
