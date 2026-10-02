import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  DEFAULT_AI_REASONING_EFFORT,
  getAiModelLabel,
  getAiModelOptions,
  getAiModelReasoningLevels,
  getAiReasoningLabel,
} from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";

interface AiModelPickerProps {
  variant?: "header" | "settings" | "compact";
}

const TRIGGER_STYLES = {
  header: ["header", "hidden h-8 px-2 text-xs lg:inline-flex"],
  compact: ["ghost", "h-8 min-w-0 max-w-full shrink px-2 text-xs"],
  settings: ["outline", "h-11 w-full max-w-sm justify-between px-3"],
} as const;

export function AiModelPicker({ variant = "settings" }: AiModelPickerProps) {
  const { config, customConfig, update } = useAiProviderSettings();
  const [view, setView] = useState<"closed" | "thinking" | "models">("closed");
  const open = view !== "closed";
  const selectingModel = view === "models";
  const modelIcon = selectingModel ? "ChevronLeft" : "ChevronDown";
  const [buttonVariant, triggerClassName] = TRIGGER_STYLES[variant];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dismissedOutsideRef = useRef(false);
  const focusRef = useRef<HTMLButtonElement>(null);
  const thinkingHintId = useId();
  const modelLabel = getAiModelLabel(config.model);
  const preference =
    customConfig.reasoningEffort ?? DEFAULT_AI_REASONING_EFFORT;
  const levels = getAiModelReasoningLevels(config.model);
  const effort = config.reasoningEffort;
  const effortLabel = effort ? getAiReasoningLabel(effort) : "Unavailable";
  const selectedIndex = levels.findIndex((level) => level.value === effort);
  const configuredOptions = getAiModelOptions();
  const options = configuredOptions.some((option) => option.id === config.model)
    ? configuredOptions
    : [{ id: config.model }, ...configuredOptions];

  useEffect(() => {
    if (!open) return;
    focusRef.current?.focus();

    const dismissOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        [triggerRef, contentRef].some((ref) => ref.current?.contains(target))
      ) {
        return;
      }
      dismissedOutsideRef.current = true;
      setView("closed");
    };

    // Canvas gestures can stop events before Radix's bubbling outside-click handler.
    document.addEventListener("pointerdown", dismissOnOutsidePress, true);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePress, true);
  }, [open, selectingModel]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) dismissedOutsideRef.current = false;
        setView(nextOpen ? "thinking" : "closed");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant={buttonVariant}
          aria-label={`AI model and thinking: ${modelLabel}, ${effortLabel}`}
          className={triggerClassName}
        >
          <Text
            size={variant === "settings" ? "sm" : "xs"}
            tone={variant === "header" ? "inverted" : "inherit"}
            className="truncate"
          >
            {modelLabel}
            {effort && ` · ${effortLabel}`}
          </Text>
          <Icon name="ChevronDown" size="xs" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align={variant === "header" ? "end" : "start"}
        side={variant === "compact" ? "top" : "bottom"}
        aria-label="Model and thinking"
        className="w-80 p-2"
        onCloseAutoFocus={(event) => {
          if (dismissedOutsideRef.current) event.preventDefault();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          if (!selectingModel) return;
          event.preventDefault();
          setView("thinking");
        }}
      >
        <BlockStack gap="2">
          <Button
            ref={selectingModel ? undefined : focusRef}
            type="button"
            variant="ghost"
            className="h-11 w-full justify-start gap-2 px-3"
            aria-label={selectingModel ? "Back to thinking" : "Choose a model"}
            onClick={() => setView(selectingModel ? "thinking" : "models")}
          >
            <Icon name={modelIcon} size="sm" />
            {selectingModel ? "Models" : modelLabel}
          </Button>
          {selectingModel ? (
            options.map((option) => (
              <Button
                key={option.id}
                ref={option.id === config.model ? focusRef : undefined}
                type="button"
                variant="ghost"
                aria-label={option.label ?? option.id}
                aria-pressed={option.id === config.model}
                className="h-auto w-full justify-between px-3 py-3 text-left whitespace-normal aria-[pressed=true]:bg-accent"
                onClick={() => {
                  update({ model: option.id });
                  setView("thinking");
                }}
              >
                <BlockStack as="span" gap="1">
                  {option.label ?? option.id}
                  {option.description && (
                    <Text size="xs" tone="subdued">
                      {option.description}
                    </Text>
                  )}
                </BlockStack>
                {option.id === config.model && (
                  <Icon name="Check" size="sm" className="shrink-0" />
                )}
              </Button>
            ))
          ) : (
            <BlockStack gap="4" className="p-3">
              <Text size="xs" weight="medium">
                Thinking: {effortLabel}
              </Text>
              {effort && (
                <BlockStack gap="2">
                  <Slider
                    max={Math.max(1, levels.length - 1)}
                    value={[selectedIndex]}
                    disabled={levels.length < 2}
                    thumbProps={{
                      "aria-label": "Thinking",
                      "aria-valuetext": effortLabel,
                      "aria-describedby": thinkingHintId,
                    }}
                    onValueChange={([index]) => {
                      const level = levels[index];
                      if (level && level.value !== effort) {
                        update({ reasoningEffort: level.value });
                      }
                    }}
                  />
                  <InlineStack align="space-between" className="w-full">
                    <Text size="xs" tone="subdued">
                      Faster
                    </Text>
                    <Text size="xs" tone="subdued">
                      Deeper
                    </Text>
                  </InlineStack>
                </BlockStack>
              )}
              <Paragraph id={thinkingHintId} size="xs" tone="subdued">
                {!effort
                  ? "Thinking controls aren’t available for this model."
                  : effort !== preference
                    ? `Using ${effortLabel.toLowerCase()} for this model. Your ${getAiReasoningLabel(preference).toLowerCase()} preference is saved.`
                    : "More thinking gives the model more time to work through a task."}
              </Paragraph>
            </BlockStack>
          )}
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
