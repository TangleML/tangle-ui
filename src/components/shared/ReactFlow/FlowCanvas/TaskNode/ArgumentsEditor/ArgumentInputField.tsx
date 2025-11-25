/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import equal from "fast-deep-equal";
import { HelpCircle, Info, Maximize2, PlusSquare } from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallbackOnUnmount } from "@/hooks/useCallbackOnUnmount";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import type { ArgumentInput } from "@/types/arguments";

import { ArgumentInputDialog } from "./ArgumentInputDialog";
import {
  getDefaultValue,
  getInputValue,
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

  const [inputValue, setInputValue] = useState(getInputValue(argument) ?? "");
  const [showDescription, setShowDescription] = useState(false);
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
    const value = inputValue.trim();
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
      value: inputValue.trim(),
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

  const handleBackgroundClick = useCallback((e: MouseEvent) => {
    // Prevent toggling description if a child input or button is clicked
    const target = e.target as HTMLElement;
    if (
      target.closest("input") ||
      target.closest("button") ||
      target.closest("[role=button]")
    ) {
      return;
    }
    e.stopPropagation();
    setShowDescription((prev) => !prev);
  }, []);

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
    const inputPlaceholder = getPlaceholder(argument.value);
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
  }, [argument]);

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

  return (
    <>
      <BlockStack gap="2" className="relative w-full">
        <div
          className="flex w-full items-center justify-between gap-2 py-1 rounded-md hover:bg-secondary/70 cursor-pointer"
          onClick={handleBackgroundClick}
        >
          <InlineStack
            blockAlign="center"
            align="space-between"
            gap="2"
            className="w-32 pr-2"
          >
            <div className="flex items-center gap-2">
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
                <TooltipContent className="z-9999">
                  Recently changed
                </TooltipContent>
              </Tooltip>
              <BlockStack className={cn(argument.isRemoved && "opacity-50")}>
                <Label
                  htmlFor={argument.inputSpec.name}
                  className="text-sm wrap-break-word"
                >
                  {argument.inputSpec.name.replace(/_/g, " ")}
                </Label>
                <span
                  className="text-xs text-muted-foreground truncate"
                  title={typeSpecToString(argument.inputSpec.type)}
                >
                  ({typeSpecToString(argument.inputSpec.type)}
                  {!argument.inputSpec.optional ? "*" : ""})
                </span>
              </BlockStack>
            </div>
            {!!hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent className="z-9999">{hint}</TooltipContent>
              </Tooltip>
            )}
          </InlineStack>

          <div className="relative min-w-24 grow group">
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
                      "border-gray-100 text-muted-foreground",
                    argument.isRemoved && "opacity-50 focus:opacity-100",
                  )}
                  disabled={disabled}
                />
              </TooltipTrigger>
              {placeholder && !inputValue && (
                <TooltipContent className="z-9999">
                  {placeholder}
                </TooltipContent>
              )}
            </Tooltip>
            <Button
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 hover:bg-transparent hover:text-blue-500 hidden group-hover:flex",
              )}
              onClick={handleExpand}
              disabled={disabled}
              variant="ghost"
            >
              <Maximize2 />
            </Button>
          </div>

          <InlineStack align="end" blockAlign="center">
            <div
              onClick={(e) => e.stopPropagation()}
              className={cn(disabledCopy && "cursor-default")}
            >
              <TooltipButton
                onClick={handleCopy}
                className={cn(argument.isRemoved ? "invisible" : "")}
                disabled={disabledCopy}
                variant="ghost"
                size="icon"
                tooltip="Copy Value"
              >
                <Icon name="Copy" />
              </TooltipButton>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className={cn(disabledReset && "cursor-default")}
            >
              <TooltipButton
                onClick={handleReset}
                className={cn(argument.isRemoved ? "invisible" : "")}
                disabled={disabledReset}
                variant="ghost"
                size="icon"
                tooltip="Reset to Default"
              >
                <Icon name="ListRestart" />
              </TooltipButton>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className={cn(disabled && "cursor-default")}
            >
              <TooltipButton
                onClick={handleRemove}
                disabled={disabled}
                variant="ghost"
                size="icon"
                tooltip={
                  argument.isRemoved ? "Include Argument" : "Exclude Argument"
                }
              >
                {argument.isRemoved ? (
                  <PlusSquare className="h-4 w-4" />
                ) : (
                  <Icon name="Delete" />
                )}
              </TooltipButton>
            </div>
          </InlineStack>
        </div>
        {showDescription && (
          <div className="z-50 bg-gray-50 text-secondary-foreground p-2 rounded-md w-full mb-2">
            <p className="text-sm">
              <Info className="h-4 w-4 inline-block mr-2" />
              {argument.inputSpec.description ?? "No description provided."}
            </p>
          </div>
        )}
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
