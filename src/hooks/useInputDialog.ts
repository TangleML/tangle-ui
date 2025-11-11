import { type ReactNode, useState } from "react";

import type { InputDialogProps } from "@/components/shared/Dialogs/InputDialog";

export type TriggerInputDialogProps = {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  content?: ReactNode;
  validate?: (value: string) => string | null;
};

const DEFAULT_TITLE = "Enter value";
const DEFAULT_DESCRIPTION = "Please provide the required information.";
const DEFAULT_PLACEHOLDER = "Enter value";

const DEFAULT_INPUT_DIALOG = {
  isOpen: false,
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  placeholder: DEFAULT_PLACEHOLDER,
  defaultValue: "",
  content: null,
  validate: undefined,
};

export default function useInputDialog() {
  const [inputDialog, setInputDialog] =
    useState<InputDialogProps>(DEFAULT_INPUT_DIALOG);

  const [resolver, setResolver] = useState<{
    resolve: (value: string | null) => void;
  } | null>(null);

  const resetInputDialog = () => {
    setInputDialog(DEFAULT_INPUT_DIALOG);
  };

  const triggerInputDialog = async ({
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    placeholder = DEFAULT_PLACEHOLDER,
    defaultValue = "",
    content,
    validate,
  }: TriggerInputDialogProps): Promise<string | null> => {
    setInputDialog({
      isOpen: true,
      title,
      description,
      placeholder,
      defaultValue,
      content,
      validate,
    });

    return new Promise<string | null>((resolve) => {
      setResolver({ resolve });
    });
  };

  const onConfirm = (value: string) => {
    resolver?.resolve(value);
    setResolver(null);
    resetInputDialog();
  };

  const onCancel = () => {
    resolver?.resolve(null);
    setResolver(null);
    resetInputDialog();
  };

  return {
    ...inputDialog,
    triggerInputDialog,
    onConfirm,
    onCancel,
  };
}
