import { MultilineTextInputDialog } from "@/components/shared/Dialogs/MultilineTextInputDialog";
import type { ArgumentInput } from "@/types/arguments";

import { getInputValue, typeSpecToString } from "./utils";

export const ArgumentInputDialog = ({
  argument,
  placeholder,
  lastSubmittedValue,
  open,
  onCancel,
  onConfirm,
}: {
  argument: ArgumentInput;
  placeholder?: string;
  lastSubmittedValue?: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) => {
  const titleMarkup = (
    <>
      {argument.key}{" "}
      <span className="text-muted-foreground text-xs font-normal ml-1">
        ({typeSpecToString(argument.inputSpec.type)}
        {!argument.inputSpec.optional ? "*" : ""})
      </span>
    </>
  );

  const description =
    argument.inputSpec.description || "Enter the value for this argument.";
  const initialValue = getArgumentDisplayValue(argument, lastSubmittedValue);

  return (
    <MultilineTextInputDialog
      title={titleMarkup}
      description={description}
      placeholder={placeholder}
      initialValue={initialValue}
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      highlightSyntax
    />
  );
};

function getArgumentDisplayValue(
  argument: ArgumentInput,
  lastSubmittedValue?: string,
): string {
  if (argument.isRemoved) {
    return lastSubmittedValue || getInputValue(argument) || "";
  }
  return getInputValue(argument) || "";
}
