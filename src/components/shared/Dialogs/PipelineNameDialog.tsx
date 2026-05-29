import {
  Activity,
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useMemo,
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

interface PipelineNameDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  title: string;
  description?: string;
  initialName: string;
  excludeNames?: string[];
  submitButtonText: string;
  submitButtonIcon?: ReactNode;
  onSubmit: (name: string) => void;
  isSubmitDisabled?: (name: string, error: string | null) => boolean;
  onOpenChange?: (open: boolean) => void;
}

const PipelineNameDialog = ({
  trigger,
  open,
  title,
  description = "Please, name your pipeline.",
  initialName,
  excludeNames,
  submitButtonText,
  submitButtonIcon,
  onSubmit,
  isSubmitDisabled,
  onOpenChange,
}: PipelineNameDialogProps) => {
  const [name, setName] = useState(initialName);

  const {
    userPipelines,
    isLoadingUserPipelines,
    refetch: refetchUserPipelines,
  } = useLoadUserPipelines();

  const error = useMemo(() => {
    if (isLoadingUserPipelines) return null;
    const normalized = name.trim().toLowerCase();
    if (normalized === "") return "Name cannot be empty";
    const excluded = new Set(
      (excludeNames ?? []).map((n) => n.trim().toLowerCase()),
    );
    const existing = new Set(
      Array.from(userPipelines.keys())
        .map((n) => n.toLowerCase())
        .filter((n) => !excluded.has(n)),
    );
    if (existing.has(normalized)) return "Name already exists";
    return null;
  }, [name, userPipelines, isLoadingUserPipelines, excludeNames]);

  const handleOnChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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
