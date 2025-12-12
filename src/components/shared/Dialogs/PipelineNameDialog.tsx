import {
  Activity,
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useState,
} from "react";

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

type PipelineNameDialogPropsBase = {
  title: string;
  description?: string;
  initialName: string;
  submitButtonText: string;
  submitButtonIcon?: ReactNode;
  onSubmit: (name: string) => void;
  isSubmitDisabled?: (name: string, error: string | null) => boolean;
};

type PipelineNameDialogProps = PipelineNameDialogPropsBase &
  (
    | {
        trigger: ReactNode;
        open?: never;
        onOpenChange?: never;
      }
    | {
        trigger?: never;
        open: boolean;
        onOpenChange: (open: boolean) => void;
      }
  );

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

      const normalizedNewName = newName.trim().toLowerCase();

      if (normalizedNewName === "") {
        setError("Name cannot be empty");
      } else if (existingPipelineNames.has(normalizedNewName)) {
        setError("Name already exists");
      } else {
        setError(null);
      }

      setName(newName);
    },
    [userPipelines],
  );

  const handleDialogOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setError(null);
      } else {
        setName(initialName);
        refetchUserPipelines();
      }
      onOpenChange?.(newOpen);
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

  const dialogContent = (
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
  );

  // Controlled mode
  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  // Uncontrolled mode
  return (
    <Dialog onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {dialogContent}
    </Dialog>
  );
};

export default PipelineNameDialog;
