import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  DEFAULT_AI_REASONING_EFFORT,
  getAiModelLabel,
  getAiModelReasoningLevels,
  getAiReasoningLabel,
  getEffectiveReasoningEffort,
} from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useAvailableAiModels } from "@/hooks/useAvailableAiModels";
import { cn } from "@/lib/utils";
import type { AiProviderConfig } from "@/types/aiProvider";

interface AiModelPickerProps {
  variant?: "header" | "settings" | "compact";
  availabilityConfig?: AiProviderConfig;
}

export function AiModelPicker({
  variant = "settings",
  availabilityConfig,
}: AiModelPickerProps) {
  const { config, customConfig, update } = useAiProviderSettings();
  const [open, setOpen] = useState(false);
  const [selectingModel, setSelectingModel] = useState(false);
  const [thinkingChanged, setThinkingChanged] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dismissedOutsideRef = useRef(false);
  const modelTitleRef = useRef<HTMLButtonElement>(null);
  const selectedModelRef = useRef<HTMLButtonElement>(null);
  const thinkingHintId = useId();
  const modelLabel = getAiModelLabel(config.model);
  const preference =
    customConfig.reasoningEffort ?? DEFAULT_AI_REASONING_EFFORT;
  const levels = getAiModelReasoningLevels(config.model);
  const effort = getEffectiveReasoningEffort(config.model, preference);
  const effortLabel = effort ? getAiReasoningLabel(effort) : "Unavailable";
  const selectedIndex = Math.max(
    0,
    levels.findIndex((level) => level.value === effort),
  );
  const { options, isLoading, isError, refetch } = useAvailableAiModels(
    availabilityConfig ?? config,
    open,
  );
  const modelUnavailable =
    open &&
    !isLoading &&
    !isError &&
    !options.some((option) => option.id === config.model);

  useEffect(() => {
    if (open) modelTitleRef.current?.focus();
  }, [open, selectingModel]);

  useEffect(() => {
    if (open && selectingModel && !isLoading) selectedModelRef.current?.focus();
  }, [open, selectingModel, isLoading]);

  useEffect(() => {
    if (!open) return;

    const dismissOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      dismissedOutsideRef.current = true;
      setOpen(false);
      setSelectingModel(false);
      setThinkingChanged(false);
    };

    // Canvas gestures can stop events before Radix's bubbling outside-click handler.
    document.addEventListener("pointerdown", dismissOnOutsidePress, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePress, true);
    };
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) dismissedOutsideRef.current = false;
        setOpen(nextOpen);
        setSelectingModel(false);
        setThinkingChanged(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant={
            variant === "header"
              ? "header"
              : variant === "compact"
                ? "ghost"
                : "outline"
          }
          aria-label={`AI model and thinking: ${modelLabel}, ${effortLabel}`}
          className={cn(
            "gap-2.5 rounded-lg font-normal",
            variant === "header"
              ? "hidden h-8 px-2 text-xs lg:inline-flex"
              : variant === "compact"
                ? "h-8 min-w-0 max-w-full shrink px-2 text-xs"
                : "h-11 w-full max-w-sm justify-between px-3",
          )}
        >
          <Text
            size={variant === "settings" ? "sm" : "xs"}
            weight="medium"
            tone={variant === "header" ? "inverted" : "inherit"}
            className="truncate"
          >
            {modelLabel}
          </Text>
          <InlineStack as="span" gap="2" wrap="nowrap" className="shrink-0">
            {effort && (
              <Text
                size="xs"
                tone={variant === "header" ? "inverted" : "subdued"}
                className={variant === "header" ? "opacity-60" : undefined}
              >
                {effortLabel}
              </Text>
            )}
            <Icon name="ChevronDown" size="xs" className="opacity-60" />
          </InlineStack>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align={variant === "header" ? "end" : "start"}
        side={variant === "compact" ? "top" : "bottom"}
        sideOffset={8}
        aria-label="Model and thinking"
        className="w-80 rounded-2xl border-border/70 p-1.5 shadow-xl shadow-black/10"
        onCloseAutoFocus={(event) => {
          if (dismissedOutsideRef.current) event.preventDefault();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          if (!selectingModel) return;
          event.preventDefault();
          setSelectingModel(false);
        }}
      >
        {selectingModel ? (
          <BlockStack gap="1">
            <Button
              ref={modelTitleRef}
              type="button"
              variant="ghost"
              className="h-9 justify-start gap-2 rounded-lg px-3"
              onClick={() => setSelectingModel(false)}
              aria-label="Back to thinking"
            >
              <Icon name="ChevronLeft" size="sm" />
              <Text size="xs" tone="subdued" weight="medium">
                Models
              </Text>
            </Button>
            {isLoading ? (
              <Text size="sm" tone="subdued" className="p-3" role="status">
                Loading models…
              </Text>
            ) : isError ? (
              <BlockStack gap="2" className="p-3">
                <Paragraph size="sm" tone="subdued" role="alert">
                  Couldn’t load available models.
                </Paragraph>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </BlockStack>
            ) : options.length === 0 ? (
              <Paragraph size="sm" tone="subdued" className="p-3">
                No compatible models are available from this provider.
              </Paragraph>
            ) : (
              options.map((option) => (
                <Button
                  key={option.id}
                  ref={
                    option.id === config.model ? selectedModelRef : undefined
                  }
                  type="button"
                  variant="ghost"
                  aria-label={option.label ?? option.id}
                  aria-pressed={option.id === config.model}
                  className={cn(
                    "h-auto w-full justify-between gap-3 rounded-xl px-3 py-3 text-left whitespace-normal",
                    option.id === config.model && "bg-accent/60",
                  )}
                  onClick={() => {
                    update({ model: option.id });
                    setSelectingModel(false);
                  }}
                >
                  <BlockStack as="span" gap="1">
                    <Text size="sm" weight="medium">
                      {option.label ?? option.id}
                    </Text>
                    {option.description && (
                      <Text
                        size="xs"
                        tone="subdued"
                        weight="regular"
                        className="leading-relaxed"
                      >
                        {option.description}
                      </Text>
                    )}
                  </BlockStack>
                  {option.id === config.model && (
                    <Icon name="Check" size="sm" className="shrink-0" />
                  )}
                </Button>
              ))
            )}
          </BlockStack>
        ) : (
          <BlockStack>
            <Button
              ref={modelTitleRef}
              type="button"
              variant="ghost"
              className="h-12 w-full justify-between rounded-xl px-3"
              aria-label="Choose a model"
              onClick={() => {
                setSelectingModel(true);
                setThinkingChanged(false);
              }}
            >
              <Text size="sm" weight="semibold">
                {modelLabel}
              </Text>
              <Icon name="ChevronDown" size="sm" className="opacity-50" />
            </Button>
            <Separator className="my-1 opacity-60" />
            {modelUnavailable ? (
              <BlockStack gap="3" className="p-3">
                <Paragraph size="sm" tone="subdued" role="status">
                  This model isn’t available with the current provider. Choose
                  another model to continue.
                </Paragraph>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectingModel(true)}
                >
                  Choose another model
                </Button>
              </BlockStack>
            ) : (
              <BlockStack
                gap="4"
                className="ai-thinking px-3 pb-3 pt-3"
                data-effort={effort}
              >
                <InlineStack align="space-between" className="w-full">
                  <Text size="xs" tone="subdued" weight="medium">
                    Thinking
                  </Text>
                  <Text
                    key={effort}
                    size="xs"
                    weight="medium"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border border-[var(--thinking-border)] bg-[var(--thinking-tint)] px-2 py-0.5 text-[var(--thinking-ink)]",
                      thinkingChanged && "motion-safe:animate-thinking-nudge",
                    )}
                  >
                    {effort && (
                      <span
                        aria-hidden="true"
                        className="size-1 rounded-full bg-current"
                      />
                    )}
                    {effortLabel}
                  </Text>
                </InlineStack>
                {effort ? (
                  <BlockStack gap="2">
                    <Slider
                      min={0}
                      max={Math.max(1, levels.length - 1)}
                      step={1}
                      value={[selectedIndex]}
                      disabled={levels.length < 2}
                      aria-label="Thinking"
                      aria-valuetext={effortLabel}
                      aria-describedby={thinkingHintId}
                      className="h-5 cursor-grab active:cursor-grabbing data-[disabled]:cursor-default [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-[var(--thinking-tint)] [&_[data-slot=slider-range]]:bg-[var(--thinking-accent)] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:bg-[var(--thinking-accent)] [&_[data-slot=slider-thumb]]:border-popover/80 [&_[data-slot=slider-thumb]]:shadow-[0_0_0_3px_var(--thinking-tint),0_0_12px_var(--thinking-glow)] motion-safe:[&_[data-slot=slider-track]]:transition-colors motion-safe:[&_[data-slot=slider-range]]:transition-colors motion-safe:[&_[data-slot=slider-thumb]]:transition-[background-color,box-shadow] motion-reduce:[&_[data-slot=slider-thumb]]:transition-none"
                      onValueChange={([index]) => {
                        const level = levels[index];
                        if (level && level.value !== effort) {
                          setThinkingChanged(true);
                          update({ reasoningEffort: level.value });
                        }
                      }}
                    />
                    <InlineStack
                      align="space-between"
                      className="w-full px-1.5"
                      aria-hidden="true"
                    >
                      {levels.map((level) => (
                        <span
                          key={level.value}
                          className={cn(
                            "size-1 rounded-full",
                            level.value === effort
                              ? "bg-[var(--thinking-accent)]"
                              : "bg-foreground/15",
                          )}
                        />
                      ))}
                    </InlineStack>
                    <InlineStack align="space-between" className="w-full">
                      <Text size="xs" tone="subdued">
                        Faster
                      </Text>
                      <Text size="xs" tone="subdued">
                        Deeper
                      </Text>
                    </InlineStack>
                  </BlockStack>
                ) : null}
                <Paragraph
                  id={thinkingHintId}
                  size="xs"
                  tone="subdued"
                  className="leading-relaxed"
                >
                  {!effort
                    ? "Thinking controls aren’t available for this model."
                    : effort !== preference
                      ? `Using ${effortLabel.toLowerCase()} for this model. Your ${getAiReasoningLabel(preference).toLowerCase()} preference is saved.`
                      : "More thinking gives the model more time to work through a task."}
                </Paragraph>
              </BlockStack>
            )}
          </BlockStack>
        )}
      </PopoverContent>
    </Popover>
  );
}
