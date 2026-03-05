import { type ReactNode, useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type InputDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  placeholder: string;
  defaultValue: string;
  content?: ReactNode;
  disabled?: boolean;
  validate?: (value: string) => string | null;
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
};

export function InputDialog({
  isOpen,
  title,
  description,
  placeholder,
  defaultValue,
  content,
  disabled,
  validate,
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = value.trim().length > 0 && !error && !disabled;

  const handleValueChange = (newValue: string) => {
    setValue(newValue);

    if (validate) {
      const validationError = validate(newValue.trim());
      setError(validationError);
    } else {
      setError(null);
    }
  };

  const handleConfirm = () => {
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0 || disabled) {
      return;
    }

    onConfirm?.(trimmedValue);
  };

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (isOpen && defaultValue && validate) {
      const validationError = validate(defaultValue.trim());
      setError(validationError);
    }
  }, [isOpen, defaultValue, validate]);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={placeholder}
          onEnter={handleConfirm}
          onEscape={onCancel}
          autoFocus
          className={cn(!!error && "border-destructive")}
        />
        {!!error && (
          <Paragraph tone="critical" size="sm">
            {error}
          </Paragraph>
        )}
        {content}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!canConfirm}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
