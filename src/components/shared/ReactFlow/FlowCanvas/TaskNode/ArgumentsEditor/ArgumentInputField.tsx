import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph } from "@/components/ui/typography";
import { useCallbackOnUnmount } from "@/hooks/useCallbackOnUnmount";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import type { ArgumentInput } from "@/types/arguments";
import { isGraphImplementation } from "@/utils/componentSpec";

import { ArgumentInputDialog } from "./ArgumentInputDialog";
import {
  getDefaultValue,
  getInputValue,
  getInputValueAsString,
  getPlaceholder,
  typeSpecToString,
} from "./utils";

export const ArgumentInputField = ({
  argument,
  disabled = false,
  onSave,
}: {
  argument: ArgumentInput;
  disabled?: boolean;
  onSave: (argument: ArgumentInput) => void;
}) => {
  const notify = useToastNotification();
  const { currentSubgraphSpec } = useComponentSpec();

  const [inputValue, setInputValue] = useState(getInputValue(argument) ?? "");
  const [lastSubmittedValue, setLastSubmittedValue] = useState<string>(
    getInputValue(argument) ?? "",
  );

  const [isTextareaDialogOpen, setIsTextareaDialogOpen] = useState(false);

  const undoValue = useMemo(() => argument, []);
  const hint = argument.inputSpec.annotations?.hint as string | undefined;

  const handleInputChange = (e: ChangeEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setInputValue(value);
  };

  const handleBlur = () => {
    const value = getInputValueAsString(inputValue);
    handleSubmit(value);
  };

  const handleSubmit = useCallback(
    (value: string) => {
      if (value === lastSubmittedValue) return;

      const updatedArgument = {
        ...argument,
        value,
        isRemoved: false,
      };

      onSave(updatedArgument);
      setLastSubmittedValue(value);
    },
    [inputValue, lastSubmittedValue, argument, onSave],
  );

  const handleRemove = () => {
    const updatedArgument = {
      ...argument,
      value: getInputValueAsString(inputValue),
      isRemoved: !argument.isRemoved,
    };

    if (!updatedArgument.isRemoved && updatedArgument.value === "") {
      const defaultValue = getDefaultValue(updatedArgument);

      updatedArgument.value = defaultValue;

      setInputValue(defaultValue);
    }

    onSave(updatedArgument);
  };

  const handleReset = () => {
    const defaultValue = getDefaultValue(argument);

    setInputValue(defaultValue);
    onSave({ ...argument, value: defaultValue });
  };

  const handleUndo = (e: MouseEvent) => {
    e.stopPropagation();

    if (disabled) return;

    setInputValue(getInputValue(undoValue) ?? "");
    onSave({ ...undoValue });
  };

  const handleExpand = useCallback(() => {
    if (disabled) return;

    setIsTextareaDialogOpen(true);
  }, [disabled]);

  const handleDialogConfirm = useCallback(
    (value: string) => {
      setInputValue(value);
      setIsTextareaDialogOpen(false);

      handleSubmit(value);
    },
    [handleSubmit],
  );

  const handleDialogCancel = useCallback(() => {
    setIsTextareaDialogOpen(false);
  }, []);

  const handleCopy = useCallback(() => {
    if (disabled || argument.isRemoved) return;

    void navigator.clipboard
      .writeText(inputValue)
      .then(() => {
        notify(
          `Argument "${argument.inputSpec.name}" copied to clipboard`,
          "success",
        );
      })
      .catch((err) => {
        notify(
          `Failed to copy text: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      });
  }, [inputValue, disabled, argument]);

  const canUndo = useMemo(
    () => !equal(argument, undoValue),
    [argument, undoValue],
  );

  const placeholder = useMemo(() => {
    const graphSpec = isGraphImplementation(currentSubgraphSpec.implementation)
      ? currentSubgraphSpec.implementation.graph
      : undefined;
    const inputPlaceholder = getPlaceholder(argument.value, graphSpec);

    if (inputPlaceholder) {
      return inputPlaceholder;
    }

    if (argument.inputSpec.default !== undefined) {
      return argument.inputSpec.default;
    }

    if (argument.isRemoved) {
      return "";
    }

    return "";
  }, [argument, currentSubgraphSpec]);

  useEffect(() => {
    const value = getInputValue(argument);
    if (value !== undefined && value !== inputValue) {
      setInputValue(value);
      setLastSubmittedValue(value);
    }
  }, [argument]);

  const disabledCopy = useMemo(
    () => disabled || argument.isRemoved || inputValue === "",
    [inputValue, argument.isRemoved, disabled],
  );

  const disabledReset = useMemo(
    () =>
      disabled ||
      argument.isRemoved ||
      argument.value === getDefaultValue(argument),
    [argument, disabled],
  );

  useCallbackOnUnmount(handleBlur);

  const actionsBaseClass =
    "hover:bg-transparent hover:text-blue-500 hidden group-hover:flex";

  return (
    <>
      <BlockStack gap="0" className="relative w-full px-2">
        <InlineStack gap="4">
          <InlineStack
            gap="2"
            className={cn(argument.isRemoved && "opacity-50")}
          >
            <Paragraph size="sm" className="wrap-break-word">
              {argument.inputSpec.name.replace(/_/g, " ")}
            </Paragraph>

            <Paragraph
              size="xs"
              tone="subdued"
              className="truncate"
              title={typeSpecToString(argument.inputSpec.type)}
            >
              ({typeSpecToString(argument.inputSpec.type)}
              {!argument.inputSpec.optional ? "*" : ""})
            </Paragraph>
          </InlineStack>

          {argument.inputSpec.description && (
            <Popover>
              <PopoverTrigger asChild>
                <TooltipButton
                  tooltip="Description"
                  variant="ghost"
                  size="icon"
                >
                  <Icon name="Info" />
                </TooltipButton>
              </PopoverTrigger>
              <PopoverContent>
                <Paragraph size="xs" tone="subdued" className="italic">
                  {argument.inputSpec.description}
                </Paragraph>
              </PopoverContent>
            </Popover>
          )}

          {!!hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon name="CircleQuestionMark" />
              </TooltipTrigger>
              <TooltipContent className="z-9999">{hint}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "bg-success rounded-full h-2 w-2 cursor-pointer",
                  !canUndo && "invisible",
                  disabled && "opacity-50",
                )}
                onClick={handleUndo}
              />
            </TooltipTrigger>
            <TooltipContent className="z-9999">Recently changed</TooltipContent>
          </Tooltip>
        </InlineStack>

        <div className="relative group w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                id={argument.inputSpec.name}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                required={!argument.inputSpec.optional}
                className={cn(
                  "flex-1 group-hover:pr-8",
                  argument.isRemoved &&
                    !argument.inputSpec.optional &&
                    "border-red-200",
                  argument.isRemoved &&
                    argument.inputSpec.optional &&
                    "border-gray-300 text-muted-foreground",
                  argument.isRemoved &&
                    "opacity-80 focus:opacity-100 border-dashed",
                )}
                disabled={disabled}
              />
            </TooltipTrigger>
            {placeholder && !inputValue && (
              <TooltipContent className="z-9999">{placeholder}</TooltipContent>
            )}
          </Tooltip>

          <InlineStack className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 px-1 bg-sidebar">
            <TooltipButton
              onClick={handleExpand}
              className={actionsBaseClass}
              disabled={disabled}
              variant="ghost"
              size="xs"
              tooltip="Multiline Editor"
            >
              <Icon name="Maximize2" />
            </TooltipButton>
            {!disabledCopy && (
              <TooltipButton
                onClick={handleCopy}
                className={cn(actionsBaseClass, {
                  invisible: argument.isRemoved || disabledCopy,
                })}
                disabled={disabledCopy}
                variant="ghost"
                size="xs"
                tooltip="Copy Value"
              >
                <Icon name="Copy" />
              </TooltipButton>
            )}
            {!disabledReset && (
              <TooltipButton
                onClick={handleReset}
                className={cn(actionsBaseClass, {
                  invisible: argument.isRemoved,
                })}
                disabled={disabledReset}
                variant="ghost"
                size="xs"
                tooltip="Reset to Default"
              >
                <Icon name="ListRestart" />
              </TooltipButton>
            )}
            <TooltipButton
              onClick={handleRemove}
              disabled={disabled}
              variant="ghost"
              size="xs"
              className={actionsBaseClass}
              tooltip={
                argument.isRemoved ? "Include Argument" : "Exclude Argument"
              }
            >
              {argument.isRemoved ? (
                <Icon name="SquarePlus" />
              ) : (
                <Icon name="Delete" />
              )}
            </TooltipButton>
          </InlineStack>
        </div>
      </BlockStack>

      <ArgumentInputDialog
        argument={argument}
        placeholder={placeholder}
        lastSubmittedValue={lastSubmittedValue}
        open={isTextareaDialogOpen}
        onCancel={handleDialogCancel}
        onConfirm={handleDialogConfirm}
      />
    </>
  );
};
