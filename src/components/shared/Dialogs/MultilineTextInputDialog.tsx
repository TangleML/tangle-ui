import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface MultilineTextInputDialogProps {
  title: ReactNode;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  open: boolean;
  maxLength?: number;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export const MultilineTextInputDialog = ({
  title,
  description,
  placeholder,
  initialValue = "",
  open,
  maxLength,
  onCancel,
  onConfirm,
}: MultilineTextInputDialogProps) => {
  const [value, setValue] = useState(initialValue);

  const handleConfirm = useCallback(() => {
    onConfirm(value);
  }, [value, onConfirm]);

  const handleCancel = useCallback(() => {
    setValue(initialValue);
    onCancel();
  }, [initialValue, onCancel]);

  const setCursorToEnd = useCallback(
    (ref: HTMLTextAreaElement | null) => {
      if (ref && open) {
        ref.focus();
        ref.setSelectionRange(ref.value.length, ref.value.length);
      }
    },
    [open],
  );

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className={cn(!description ? "hidden" : "")}>
          {description ?? title}
        </DialogDescription>
        <Textarea
          ref={setCursorToEnd}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-h-32 max-h-[80vh]"
          maxLength={maxLength}
        />
        <DialogFooter>
          <InlineStack gap="2" align="space-between" className="w-full">
            {maxLength && value.length >= maxLength && (
              <Paragraph tone="warning" size="xs">
                Maximum length {maxLength} characters
              </Paragraph>
            )}
            <InlineStack
              gap="2"
              align="end"
              className={cn(!maxLength && "w-full")}
            >
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </InlineStack>
          </InlineStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
