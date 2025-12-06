import { useCallback, useEffect, useRef, useState } from "react";

import { AnimatedHeight } from "@/components/ui/animated-height";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { DialogInstance } from "./types";
import { createCancellationError } from "./utils";

type TransitionDirection = "forward" | "backward";

/** Map dialog size prop to Tailwind CSS classes */
const DIALOG_SIZE_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[90vw]",
} as const;

interface DialogRendererProps {
  stack: DialogInstance[];
  onClose: (id: string, result?: unknown) => void;
}

export default function DialogRenderer({
  stack,
  onClose,
}: DialogRendererProps) {
  const activeDialog = stack.length > 0 ? stack[stack.length - 1] : null;
  const hasMultipleDialogs = stack.length > 1;

  const prevStackLengthRef = useRef(stack.length);
  const [direction, setDirection] = useState<TransitionDirection>("forward");
  const [animationKey, setAnimationKey] = useState(0);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Track direction based on stack length changes
  useEffect(() => {
    const prevLength = prevStackLengthRef.current;
    const currentLength = stack.length;

    if (currentLength !== prevLength) {
      // Reset animation state when stack is empty
      if (currentLength === 0) {
        setShouldAnimate(false);
      } else {
        // Only animate when navigating between dialogs, not when opening the first one
        const isFirstDialogOpening = prevLength === 0 && currentLength === 1;

        if (!isFirstDialogOpening) {
          setDirection(currentLength > prevLength ? "forward" : "backward");
          setShouldAnimate(true);
          setAnimationKey((k) => k + 1);
        }
      }
    }

    prevStackLengthRef.current = currentLength;
  }, [stack.length]);

  const handleOpenChange = useCallback(
    (open: boolean, dialog: DialogInstance) => {
      if (!open) {
        // Dialog is being closed via ESC or overlay click
        if (
          dialog.closeOnEsc === false &&
          dialog.closeOnOverlayClick === false
        ) {
          // Don't close if both are disabled
          return;
        }

        // Cancel the dialog (reject the promise)
        dialog.reject(createCancellationError());
        onClose(dialog.id);
      }
    },
    [onClose],
  );

  const handleBack = useCallback(() => {
    if (!activeDialog) return;

    // Cancel the current dialog and pop back to the previous one
    activeDialog.reject(createCancellationError());
    onClose(activeDialog.id);
  }, [activeDialog, onClose]);

  if (!activeDialog) return null;

  const Component = activeDialog.component as React.ComponentType<{
    close: (result?: unknown) => void;
    cancel: () => void;
    [key: string]: unknown;
  }>;

  const dialogProps = {
    close: (result?: unknown) => {
      activeDialog.resolve(result);
      onClose(activeDialog.id, result);
    },
    cancel: () => {
      activeDialog.reject(createCancellationError());
      onClose(activeDialog.id);
    },
    ...activeDialog.props,
  };

  const sizeClass = DIALOG_SIZE_CLASSES[activeDialog.size ?? "md"];

  const animationClass = shouldAnimate
    ? direction === "forward"
      ? "dialog-slide-in-forward"
      : "dialog-slide-in-backward"
    : "";

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => handleOpenChange(open, activeDialog)}
    >
      <DialogContent
        className={sizeClass}
        onEscapeKeyDown={
          activeDialog.closeOnEsc === false
            ? (e) => e.preventDefault()
            : undefined
        }
        onInteractOutside={
          activeDialog.closeOnOverlayClick === false
            ? (e) => e.preventDefault()
            : undefined
        }
      >
        {hasMultipleDialogs && (
          <Button
            variant="link"
            size="icon"
            onClick={handleBack}
            className="text-muted-foreground -translate-y-1/2"
            aria-label="Go back to previous dialog"
          >
            <InlineStack
              gap="1"
              className="w-fit"
              blockAlign="center"
              wrap="nowrap"
            >
              <Icon name="ArrowLeft" size="xs" />
              <Text tone="subdued">Back</Text>
            </InlineStack>
          </Button>
        )}
        <AnimatedHeight duration={200} contentKey={animationKey}>
          <div
            key={animationKey}
            className={cn("dialog-content-inner", animationClass)}
          >
            <Component {...dialogProps} />
          </div>
        </AnimatedHeight>
      </DialogContent>
    </Dialog>
  );
}
