import { type ClipboardEvent, type KeyboardEvent, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import type { InputSpec } from "@/utils/componentSpec";

interface SweepParameterFieldProps {
  input: InputSpec;
  values: string[];
  onAddValue: (value: string) => void;
  onRemoveValue: (index: number) => void;
  onApplyRange: (rangeStr: string) => void;
  onClear: () => void;
}

export const SweepParameterField = ({
  input,
  values,
  onAddValue,
  onRemoveValue,
  onApplyRange,
  onClear,
}: SweepParameterFieldProps) => {
  const [inputValue, setInputValue] = useState("");
  const [showRange, setShowRange] = useState(false);
  const [rangeInput, setRangeInput] = useState("");

  const typeLabel = typeSpecToString(input.type);
  const isRequired = !input.optional;

  const submitValue = () => {
    if (inputValue.trim() === "") return;
    onAddValue(inputValue);
    setInputValue("");
  };

  const submitRange = () => {
    if (rangeInput.trim() === "") return;
    onApplyRange(rangeInput);
    setRangeInput("");
    setShowRange(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitValue();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes(",")) {
      e.preventDefault();
      onAddValue(pasted);
      setInputValue("");
    }
  };

  return (
    <BlockStack
      gap="2"
      className="rounded-md border border-border p-3"
      data-testid={`sweep-param-${input.name}`}
    >
      <InlineStack gap="2" blockAlign="center" wrap="nowrap" className="w-full">
        <Text size="sm" weight="semibold" className="shrink-0">
          {input.name}
        </Text>
        <Text size="xs" tone="subdued" className="shrink-0">
          ({typeLabel}
          {isRequired ? "*" : ""})
        </Text>
        <div className="flex-1" />
        {values.length > 0 && (
          <>
            <Badge
              variant="secondary"
              size="xs"
              shape="rounded"
              className="shrink-0"
            >
              {values.length}
            </Badge>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClear}
              className="shrink-0"
              data-testid={`sweep-clear-${input.name}`}
            >
              <Icon name="X" size="xs" />
            </Button>
          </>
        )}
      </InlineStack>

      {input.description && (
        <Paragraph size="xs" tone="subdued" className="italic">
          {input.description}
        </Paragraph>
      )}

      {values.length > 0 && (
        <InlineStack gap="1" wrap="wrap">
          {values.map((value, index) => (
            <Badge
              key={`${value}-${index}`}
              variant="secondary"
              className="gap-1 cursor-default"
            >
              <Text size="xs" font="mono" className="max-w-40 truncate">
                {value}
              </Text>
              <button
                type="button"
                onClick={() => onRemoveValue(index)}
                className="ml-0.5 hover:text-destructive"
                data-testid={`sweep-remove-${input.name}-${index}`}
              >
                <Icon name="X" size="xs" />
              </button>
            </Badge>
          ))}
        </InlineStack>
      )}

      <InlineStack gap="1" blockAlign="center" className="w-full">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            input.default
              ? `Add value (default: ${input.default})`
              : "Type or paste comma-separated values"
          }
          className="flex-1 bg-white!"
          data-testid={`sweep-input-${input.name}`}
        />
        <TooltipButton
          tooltip="Add value(s)"
          variant="ghost"
          size="sm"
          onClick={submitValue}
          disabled={inputValue.trim() === ""}
        >
          <Icon name="Plus" size="sm" />
        </TooltipButton>
        <TooltipButton
          tooltip="Generate values from a numeric range"
          variant="ghost"
          size="sm"
          onClick={() => setShowRange(!showRange)}
        >
          <Icon name="Hash" size="sm" />
        </TooltipButton>
      </InlineStack>

      {showRange && (
        <BlockStack gap="1" className="rounded-md bg-muted px-3 py-2">
          <Paragraph size="xs" weight="semibold">
            Range generator
          </Paragraph>
          <Paragraph size="xs" tone="subdued">
            Format: start..end [linear|log] [steps]
          </Paragraph>
          <Paragraph size="xs" tone="subdued" font="mono">
            e.g. 0.001..0.1 log 5
          </Paragraph>
          <InlineStack gap="1" blockAlign="center">
            <Input
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitRange();
                }
              }}
              placeholder="0.001..0.1 log 5"
              className="flex-1 bg-white!"
              data-testid={`sweep-range-${input.name}`}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={submitRange}
              disabled={rangeInput.trim() === ""}
            >
              Apply
            </Button>
          </InlineStack>
        </BlockStack>
      )}
    </BlockStack>
  );
};
