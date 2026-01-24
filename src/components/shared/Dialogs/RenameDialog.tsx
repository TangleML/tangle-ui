import { Activity, type ChangeEvent, type ReactNode, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

interface RenameDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  initialName: string;
  placeholder?: string;
  submitButtonText: string;
  submitButtonIcon?: ReactNode;
  onSubmit: (name: string) => void;
  isSubmitDisabled?: (name: string, error: string | null) => boolean;
  onOpenChange?: (open: boolean) => void;
  validate?: (name: string) => { warnings: string[]; errors: string[] };
}

export const RenameDialog = ({
  trigger,
  title,
  description,
  initialName,
  placeholder,
  submitButtonText,
  submitButtonIcon,
  onSubmit,
  isSubmitDisabled,
  onOpenChange,
  validate,
}: RenameDialogProps) => {
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;

    const validations = validate ? validate(newName) : null;
    if (validations) {
      if (validations.errors.length > 0) {
        setError(validations.errors.join(" "));
      } else {
        setError(null);
      }

      if (validations.warnings.length > 0) {
        setWarning(validations.warnings.join(" "));
      } else {
        setWarning(null);
      }
    }

    setName(newName);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      setWarning(null);
    } else {
      setName(initialName);
    }
    onOpenChange?.(open);
  };

  const handleSubmit = () => {
    onSubmit(name.trim());
  };

  const isDisabled = !!error || !!isSubmitDisabled?.(name, error);

  return (
    <Dialog onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <BlockStack gap="2">
          <Input
            value={name}
            onChange={handleOnChange}
            placeholder={placeholder}
          />
          <Activity mode={warning ? "visible" : "hidden"}>
            <InlineStack blockAlign="start" gap="1" wrap="nowrap">
              <Icon name="TriangleAlert" className="text-warning" />
              <Paragraph tone="warning" size="xs">
                {warning}
              </Paragraph>
            </InlineStack>
          </Activity>
          <Activity mode={error ? "visible" : "hidden"}>
            <Alert variant="destructive">
              <Icon name="CircleAlert" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </Activity>
        </BlockStack>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={handleSubmit}
              disabled={isDisabled}
            >
              {submitButtonIcon}
              {submitButtonText}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
