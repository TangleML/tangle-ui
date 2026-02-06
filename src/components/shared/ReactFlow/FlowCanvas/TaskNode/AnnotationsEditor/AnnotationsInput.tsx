import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { MultilineTextInputDialog } from "@/components/shared/Dialogs/MultilineTextInputDialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Paragraph } from "@/components/ui/typography";
import { useCallbackOnUnmount } from "@/hooks/useCallbackOnUnmount";
import { cn } from "@/lib/utils";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import { clamp } from "@/utils/math";

interface AnnotationsInputProps {
  value: string;
  config?: AnnotationConfig;
  annotations: Annotations;
  deletable?: boolean;
  autoFocus?: boolean;
  className?: string;
  onBlur?: (value: string) => void;
  onDelete?: () => void;
}

export const AnnotationsInput = ({
  value = "",
  config,
  annotations,
  deletable = false,
  autoFocus = false,
  className = "",
  onBlur,
  onDelete,
}: AnnotationsInputProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [isInvalid, setIsInvalid] = useState(false);
  const [lastSavedValue, setLastSavedValue] = useState(value);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const inputType = config?.type ?? "string";
  const placeholder = config?.label ?? "";

  const isNumericType = inputType === "number" || inputType === "integer";

  const handleExpand = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleDialogConfirm = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      setIsDialogOpen(false);
      if (onBlur && newValue !== lastSavedValue) {
        onBlur(newValue);
        setLastSavedValue(newValue);
      }
    },
    [onBlur, lastSavedValue],
  );

  const handleDialogCancel = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const validateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    setInputValue(newValue);

    if (newValue === "") {
      setIsInvalid(false);
      return;
    }

    if (config?.type === "json") {
      try {
        JSON.parse(newValue);
        setIsInvalid(false);
      } catch {
        setIsInvalid(true);
      }
    }
  }, []);

  const handleNumericInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      if (inputType === "integer") {
        newValue = newValue.replace(/[.,]/g, "");
      }

      if (newValue === "") {
        setInputValue(newValue);
        return;
      }

      const numericValue = Number(newValue);
      if (!isNaN(numericValue)) {
        setInputValue(newValue);
      }
    },
    [],
  );

  const handleNumericInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (inputType === "integer" && (e.key === "." || e.key === ",")) {
        e.preventDefault();
      }
    },
    [inputType],
  );

  const handleQuantityKeyInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!config?.annotation) return;

      const selectedKey = getAnnotationKey(config.annotation, annotations);

      if (!selectedKey) return;

      const newObj = { [selectedKey]: e.target.value };

      setInputValue(JSON.stringify(newObj));
    },
    [config, annotations],
  );

  const handleQuantityValueInputChange = useCallback(
    (value: string) => {
      const key = getKeyFromInputValue(inputValue);

      const newObj = { [key]: value };

      setInputValue(JSON.stringify(newObj));
    },
    [inputValue],
  );

  const shouldSaveQuantityField = useCallback(() => {
    if (!config?.enableQuantity) return false;

    const selectedKey = getKeyFromInputValue(inputValue);
    const quantity = getValueFromInputValue(inputValue);
    return !!selectedKey && !!quantity && quantity.trim() !== "";
  }, [config, inputValue]);

  const handleQuantitySelectChange = useCallback(
    (selectedKey: string) => {
      if (!config?.annotation) return;

      const quantity = getAnnotationValue(config.annotation, annotations);
      const newObj = selectedKey ? { [selectedKey]: quantity } : {};
      const newValue = JSON.stringify(newObj);

      setInputValue(newValue);

      if (onBlur && newValue !== lastSavedValue && shouldSaveQuantityField()) {
        onBlur(newValue);
        setLastSavedValue(newValue);
      }
    },
    [config, annotations, onBlur, lastSavedValue, shouldSaveQuantityField],
  );

  const handleNonQuantitySelectChange = useCallback(
    (selectedKey: string) => {
      setInputValue(selectedKey);

      if (onBlur && selectedKey !== lastSavedValue) {
        onBlur(selectedKey);
        setLastSavedValue(selectedKey);
      }
    },
    [onBlur, lastSavedValue],
  );

  const handleClearSelection = useCallback(() => {
    if (config?.enableQuantity) {
      const newValue = "";
      setInputValue(newValue);
      if (onBlur && newValue !== lastSavedValue) {
        onBlur(newValue);
        setLastSavedValue(newValue);
      }
    } else {
      setInputValue("");
      if (onBlur && "" !== lastSavedValue) {
        onBlur("");
        setLastSavedValue("");
      }
    }
  }, [config, onBlur, lastSavedValue]);

  const handleSwitchChange = useCallback(
    (checked: boolean) => {
      const newValue = checked ? "true" : "false";
      setInputValue(newValue);
      if (onBlur && newValue !== lastSavedValue) {
        onBlur(newValue);
        setLastSavedValue(newValue);
      }
    },
    [onBlur, lastSavedValue],
  );

  const handleBlur = useCallback(() => {
    if (config?.enableQuantity && !shouldSaveQuantityField()) return;

    if (onBlur && lastSavedValue !== inputValue && !isInvalid) {
      let value = inputValue;
      if (isNumericType && !isNaN(Number(inputValue)) && inputValue !== "") {
        value = clamp(Number(inputValue), config?.min, config?.max).toString();

        if (inputType === "integer") {
          value = Math.floor(Number(value)).toString();
        }
      }

      onBlur(value);
      setLastSavedValue(value);
    }
  }, [
    onBlur,
    shouldSaveQuantityField,
    isInvalid,
    isNumericType,
    inputType,
    lastSavedValue,
    inputValue,
    config,
  ]);

  useCallbackOnUnmount(handleBlur);

  useEffect(() => {
    setInputValue(value);
    setLastSavedValue(value);
  }, [value]);

  let inputElement = null;

  if (config?.options && config.options.length > 0) {
    const currentValue = config?.enableQuantity
      ? getKeyFromInputValue(inputValue)
      : inputValue;

    inputElement = (
      <Select
        value={currentValue}
        onValueChange={
          config?.enableQuantity
            ? handleQuantitySelectChange
            : handleNonQuantitySelectChange
        }
      >
        <div className="relative group grow min-w-24">
          <SelectTrigger className={cn("w-full", className)}>
            <SelectValue placeholder={"Select " + placeholder} />
          </SelectTrigger>
          {!!currentValue && (
            <Button
              variant="ghost"
              size="min"
              className="absolute right-8 top-1/2 -translate-y-1/2 hidden group-hover:block"
              onClick={handleClearSelection}
            >
              <Icon name="X" className="size-3 text-muted-foreground" />
            </Button>
          )}
        </div>
        <SelectContent>
          {config.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (inputType === "boolean") {
    inputElement = (
      <Switch
        checked={inputValue === "true"}
        onCheckedChange={handleSwitchChange}
        className={className}
      />
    );
  } else if (isNumericType) {
    inputElement = (
      <InlineStack gap="2" wrap="nowrap" className="grow">
        <Input
          type="number"
          value={inputValue}
          min={config?.min}
          max={config?.max}
          onChange={handleNumericInputChange}
          onKeyDown={handleNumericInputKeyDown}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          className={className}
        />

        {config?.max !== undefined && (
          <Paragraph
            size="xs"
            tone="subdued"
            className="whitespace-nowrap min-w-16"
          >
            (max: {config.max})
          </Paragraph>
        )}
      </InlineStack>
    );
  } else {
    inputElement = (
      <InlineStack gap="2" wrap="nowrap" className="grow">
        <div className="flex-1 w-full relative group">
          <Input
            value={
              config?.enableQuantity
                ? getAnnotationKey(config.annotation, annotations)
                : inputValue
            }
            onChange={
              config?.enableQuantity
                ? handleQuantityKeyInputChange
                : validateChange
            }
            onBlur={handleBlur}
            autoFocus={autoFocus}
            className={cn("min-w-16", className)}
            maxLength={config?.max}
          />
          <Button
            className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-transparent hover:text-blue-500 hidden group-hover:flex h-8 w-8 p-0"
            onClick={handleExpand}
            variant="ghost"
            type="button"
          >
            <Icon name="Maximize2" />
          </Button>
        </div>
        {isInvalid && (
          <InlineStack gap="1" className="my-1">
            <Icon name="TriangleAlert" />
            <Paragraph size="xs" tone="warning">
              Invalid JSON
            </Paragraph>
          </InlineStack>
        )}
      </InlineStack>
    );
  }

  const dialogTitle = `Edit ${config?.label ?? "Annotation"}`;

  return (
    <>
      <InlineStack gap="2" wrap="nowrap" className="w-full">
        {inputElement}
        {config?.enableQuantity && (
          <QuantityInput
            value={inputValue}
            min={config.min}
            max={config.max}
            disabled={
              !getAnnotationKey(config.annotation, annotations) &&
              !getKeyFromInputValue(inputValue)
            }
            onBlur={handleBlur}
            onChange={handleQuantityValueInputChange}
          />
        )}
        {deletable && onDelete && (
          <Button variant="ghost" size="icon" onClick={onDelete} title="Remove">
            <Icon name="Trash" className="text-destructive" />
          </Button>
        )}
      </InlineStack>

      {inputType !== "boolean" && !isNumericType && !config?.options && (
        <MultilineTextInputDialog
          title={dialogTitle}
          description="Enter a value for this annotation."
          placeholder={placeholder}
          initialValue={inputValue}
          open={isDialogOpen}
          onCancel={handleDialogCancel}
          onConfirm={handleDialogConfirm}
          maxLength={config?.max}
        />
      )}
    </>
  );
};

const QuantityInput = ({
  value,
  min,
  max,
  disabled,
  onBlur,
  onChange,
}: {
  value: string;
  min?: number;
  max?: number;
  disabled: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
}) => {
  const currentQuantity = getValueFromInputValue(value);

  const handleValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <InlineStack gap="2" wrap="nowrap" className="max-w-1/3">
      <span>x</span>
      <Input
        type="number"
        value={currentQuantity}
        min={min}
        max={max}
        onChange={handleValueChange}
        onBlur={onBlur}
        className={cn(
          "min-w-12 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          !currentQuantity && !disabled && "border-destructive/50",
        )}
        disabled={disabled}
      />
      {max !== undefined && (
        <Paragraph size="xs" tone="subdued" className="whitespace-nowrap">
          (max: {max})
        </Paragraph>
      )}
    </InlineStack>
  );
};

function parseJsonAndGetProperty(
  jsonString: string,
  getKey: boolean = true,
): string {
  try {
    const obj = JSON.parse(jsonString || "{}");
    const firstKey = Object.keys(obj)[0];
    return getKey ? firstKey || "" : obj[firstKey] || "";
  } catch {
    return "";
  }
}

function getAnnotationKey(annotation: string, annotations: Annotations) {
  return parseJsonAndGetProperty(annotations[annotation] || "{}", true);
}

function getAnnotationValue(annotation: string, annotations: Annotations) {
  return parseJsonAndGetProperty(annotations[annotation] || "{}", false);
}

function getKeyFromInputValue(inputValue: string): string {
  return parseJsonAndGetProperty(inputValue, true);
}

function getValueFromInputValue(inputValue: string): string {
  return parseJsonAndGetProperty(inputValue, false);
}
