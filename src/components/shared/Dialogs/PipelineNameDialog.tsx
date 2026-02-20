import {
  Activity,
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useState,
} from "react";
import { z } from "zod";

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
import useLoadUserPipelines from "@/hooks/useLoadUserPipelines";

const PipelineNameSchema = z.string().trim().min(1, "Name cannot be empty");

interface PipelineNameDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  initialName: string;
  submitButtonText: string;
  submitButtonIcon?: ReactNode;
  onSubmit: (name: string) => void;
  isSubmitDisabled?: (name: string, error: string | null) => boolean;
  onOpenChange?: (open: boolean) => void;
}

const PipelineNameDialog = ({
  trigger,
  title,
  description = "Please, name your pipeline.",
  initialName,
  submitButtonText,
  submitButtonIcon,
  onSubmit,
  isSubmitDisabled,
  onOpenChange,
}: PipelineNameDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);

  const {
    userPipelines,
    isLoadingUserPipelines,
    refetch: refetchUserPipelines,
  } = useLoadUserPipelines();

  const handleOnChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      const existingPipelineNames = new Set(
        Array.from(userPipelines.keys()).map((name) => name.toLowerCase()),
      );

      const nameResult = PipelineNameSchema.safeParse(newName);
      if (!nameResult.success) {
        setError(nameResult.error.issues[0].message);
      } else if (existingPipelineNames.has(nameResult.data.toLowerCase())) {
        setError("Name already exists");
      } else {
        setError(null);
      }

      setName(newName);
    },
    [userPipelines],
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setError(null);
      } else {
        setName(initialName);
        refetchUserPipelines();
      }
      onOpenChange?.(open);
    },
    [initialName, onOpenChange, refetchUserPipelines],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(name.trim());
  }, [name, onSubmit]);

  const isDisabled =
    isLoadingUserPipelines ||
    !!error ||
    !name ||
    !!isSubmitDisabled?.(name, error);

  return (
    <Dialog onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <BlockStack gap="2">
          <Input value={name} onChange={handleOnChange} />
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

export default PipelineNameDialog;
