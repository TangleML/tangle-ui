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
import { BlockStack } from "@/components/ui/layout";

interface PipelineNameDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  title: string;
  description?: string;
  initialName: string;
  submitButtonText: string;
  submitButtonIcon?: ReactNode;
  onSubmit: (name: string) => void;
  // Receives the trimmed name — the exact value that will be submitted — so
  // callers' equality checks stay aligned with the duplicate-name guard.
  isSubmitDisabled?: (name: string, error: string | null) => boolean;
  onOpenChange?: (open: boolean) => void;
}

const PipelineNameDialog = ({
  trigger,
  open,
  title,
  description = "Please, name your pipeline.",
  initialName,
  submitButtonText,
  submitButtonIcon,
  onSubmit,
  isSubmitDisabled,
  onOpenChange,
}: PipelineNameDialogProps) => {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);

  const error = name.trim() ? null : "Name cannot be empty";

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setTouched(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setName(initialName);
      setTouched(false);
    }
    onOpenChange?.(open);
  };

  const trimmedName = name.trim();

  const handleSubmit = () => {
    onSubmit(trimmedName);
  };

  const isDisabled =
    !!error || !trimmedName || !!isSubmitDisabled?.(trimmedName, error);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <BlockStack gap="2">
          <Input value={name} onChange={handleOnChange} />
          <Activity mode={error && touched ? "visible" : "hidden"}>
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

export default PipelineNameDialog;
