import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/typography";
import {
  AI_REASONING_EFFORTS,
  type AiModelSelection,
  type AiReasoningEffort,
  DEFAULT_AI_REASONING_EFFORT,
  getAiModelLabel,
  getAiModelOptions,
  getAiReasoningConfig,
  getDefaultAiModelId,
} from "@/config/aiModels";
import { cn } from "@/lib/utils";

const DEFAULT_MODEL_VALUE = "__default__";

interface AiModelSelectProps {
  model: string;
  reasoningEffort?: AiReasoningEffort;
  onChange: (selection: AiModelSelection) => void;
  appearance?: "header" | "field";
  ariaLabel?: string;
}

export function AiModelSelect({
  model,
  reasoningEffort = DEFAULT_AI_REASONING_EFFORT,
  onChange,
  appearance = "field",
  ariaLabel = "AI model",
}: AiModelSelectProps) {
  const labelId = useId();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const options = getAiModelOptions();
  const selectedModel = model.trim();
  const supportsThinking = Boolean(getAiReasoningConfig(selectedModel));
  const effortIndex =
    previewIndex ??
    AI_REASONING_EFFORTS.findIndex(
      (option) => option.value === reasoningEffort,
    );
  const effort = AI_REASONING_EFFORTS[effortIndex] ?? AI_REASONING_EFFORTS[2];
  const modelLabel = getAiModelLabel(selectedModel);
  const isMax = supportsThinking && effort.value === "max";

  return (
    <Popover onOpenChange={() => setPreviewIndex(null)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={appearance === "header" ? "header" : "ghost"}
          aria-label={ariaLabel}
          title={
            "AI model: " +
            modelLabel +
            (supportsThinking ? " · " + effort.label : "")
          }
          className={cn(
            "max-w-56 min-w-0 justify-between gap-2 bg-transparent px-1 font-normal shadow-none hover:bg-transparent dark:hover:bg-transparent",
            appearance === "header" && "hidden h-8 text-sm lg:inline-flex",
          )}
        >
          <Text size="sm" className="truncate text-inherit">
            {selectedModel || "Provider default"}
          </Text>
          <Icon
            name="ChevronDown"
            size="sm"
            className="shrink-0 opacity-60"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-label="AI model and thinking"
        onKeyDown={(event) => event.stopPropagation()}
        className="w-80 rounded-3xl border-border/80 bg-popover p-5 shadow-xl motion-reduce:animate-none"
      >
        <BlockStack gap="5" className="relative">
          <Select
            value={supportsThinking ? selectedModel : ""}
            onValueChange={(nextModel) => {
              if (nextModel) {
                onChange({
                  model:
                    nextModel === DEFAULT_MODEL_VALUE
                      ? getDefaultAiModelId()
                      : nextModel,
                  reasoningEffort,
                });
              }
            }}
          >
            <SelectTrigger
              type="button"
              aria-label="Choose model"
              className="mx-auto h-auto max-w-52 justify-center rounded-xl border-0 px-3 py-1 text-center shadow-none hover:bg-accent focus-visible:ring-ring/50 [&>svg]:hidden"
            >
              <BlockStack as="span" gap="1" align="center" className="min-w-0">
                <InlineStack as="span" gap="1" wrap="nowrap">
                  <Text
                    size="xl"
                    weight="medium"
                    className="text-brand dark:text-violet-300"
                  >
                    {supportsThinking ? effort.label : "Choose model"}
                  </Text>
                  <Icon
                    name="ChevronRight"
                    size="md"
                    className="text-muted-foreground"
                    aria-hidden="true"
                  />
                </InlineStack>
                <Text size="sm" tone="subdued" className="max-w-40 truncate">
                  {modelLabel.replace(/^GPT-/, "")}
                </Text>
              </BlockStack>
            </SelectTrigger>
            <SelectContent
              align="center"
              sideOffset={8}
              collisionPadding={12}
              className="w-72 max-w-[calc(100vw-1.5rem)] rounded-3xl p-2 shadow-xl motion-reduce:animate-none"
            >
              <SelectGroup>
                <SelectLabel className="px-3 pb-2 font-normal text-muted-foreground">
                  Select model
                </SelectLabel>
                <SelectItem
                  value={DEFAULT_MODEL_VALUE}
                  textValue="Default"
                  aria-labelledby={labelId}
                  className="rounded-xl py-2.5 pl-3"
                >
                  <BlockStack as="span" gap="0">
                    <Text id={labelId} size="sm">
                      Default
                    </Text>
                    <Text size="xs" tone="subdued">
                      GPT-6 Sol
                    </Text>
                  </BlockStack>
                </SelectItem>
                {options.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    className="rounded-xl py-2.5 pl-3"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Reset to GPT-6 Sol and High thinking"
            title="Reset to GPT-6 Sol and High"
            className="absolute -top-1 -right-2 size-8 rounded-full text-muted-foreground"
            onClick={() => {
              setPreviewIndex(null);
              onChange({
                model: getDefaultAiModelId(),
                reasoningEffort: DEFAULT_AI_REASONING_EFFORT,
              });
            }}
          >
            <Icon name="RotateCcw" size="lg" aria-hidden="true" />
          </Button>
          <BlockStack className="relative" gap="2">
            <Slider
              aria-label="Thinking level"
              aria-valuetext={effort.label}
              disabled={!supportsThinking}
              min={0}
              max={AI_REASONING_EFFORTS.length - 1}
              step={1}
              value={[effortIndex]}
              onValueChange={([index]) => setPreviewIndex(index ?? null)}
              onValueCommit={([index]) => {
                const nextEffort = AI_REASONING_EFFORTS[index];
                setPreviewIndex(null);
                if (nextEffort)
                  onChange({
                    model: selectedModel,
                    reasoningEffort: nextEffort.value,
                  });
              }}
              className={cn(
                "h-11 [&_[data-slot=slider-track]]:h-9 [&_[data-slot=slider-track]]:bg-foreground/15 [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-inset [&_[data-slot=slider-track]]:ring-foreground/10",
                "[&_[data-slot=slider-range]]:bg-brand [&_[data-slot=slider-thumb]]:relative [&_[data-slot=slider-thumb]]:z-10 [&_[data-slot=slider-thumb]]:size-11 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-md [&_[data-slot=slider-thumb]]:focus-visible:ring-[3px] [&_[data-slot=slider-thumb]]:focus-visible:ring-ring/50",
                !supportsThinking && "opacity-40",
                isMax &&
                  "[&_[data-slot=slider-range]]:bg-linear-to-r [&_[data-slot=slider-range]]:from-indigo-500 [&_[data-slot=slider-range]]:via-violet-400 [&_[data-slot=slider-range]]:to-brand",
              )}
            />
            <InlineStack
              aria-hidden="true"
              align="space-between"
              className="pointer-events-none absolute inset-x-5 top-5"
            >
              {AI_REASONING_EFFORTS.map((option) => (
                <span
                  key={option.value}
                  className="size-1.5 rounded-full bg-white/35"
                />
              ))}
            </InlineStack>
            {isMax && (
              <svg
                aria-hidden="true"
                viewBox="0 0 280 44"
                className="pointer-events-none absolute inset-0 h-11 w-full fill-white/55"
              >
                <circle cx="34" cy="12" r="1.5" />
                <circle cx="48" cy="30" r="1" />
                <circle cx="71" cy="18" r="1" />
                <circle cx="95" cy="34" r="1.5" />
                <circle cx="120" cy="10" r="1" />
                <circle cx="137" cy="26" r="1.5" />
                <circle cx="160" cy="16" r="1" />
                <circle cx="184" cy="32" r="1" />
                <circle cx="205" cy="12" r="1.5" />
                <circle cx="224" cy="28" r="1" />
              </svg>
            )}
            {!supportsThinking && (
              <Text size="xs" tone="subdued">
                Choose a GPT-6 model to adjust thinking. Custom model IDs stay
                available in Settings.
              </Text>
            )}
          </BlockStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
