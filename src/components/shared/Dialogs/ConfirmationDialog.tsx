import type { VariantProps } from "class-variance-authority";
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
import { Button, buttonVariants } from "@/components/ui/button";

type SecondaryAction = {
  label: string;
  onClick: () => void;
  variant: VariantProps<typeof buttonVariants>["variant"];
};

type ConfirmationDialogProps = {
  title?: string;
  description?: string;
  content?: ReactNode;
  destructive?: boolean;
  secondaryAction?: SecondaryAction;
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
  destructive = false,
  secondaryAction,
  isOpen,
  onConfirm,
  onCancel = () => {},
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

  const handleSecondaryAction = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      secondaryAction?.onClick();
    },
    [secondaryAction],
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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "outline"}
              onClick={handleSecondaryAction}
            >
              {secondaryAction.label}
            </Button>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            autoFocus
            className={
              destructive
                ? buttonVariants({ variant: "destructive" })
                : undefined
            }
          >
            {destructive ? "Delete" : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
