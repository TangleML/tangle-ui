import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  AI_CONFIG,
  getAiModelLabel,
  getAiModelOptions,
  getAiModelReasoningLevels,
  getAiReasoningLabel,
  getEffectiveReasoningEffort,
} from "@/config/aiConfig";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import type { AiReasoningEffort } from "@/types/aiProvider";

interface AiModelPickerProps {
  variant?: "header" | "settings" | "compact";
  modelDraft?: string | null;
  onModelSelect?: () => void;
  onCustomModelSelect?: (model: string) => void;
}

const TRIGGER_STYLES = {
  header: ["header", "hidden h-8 px-2 text-xs lg:inline-flex"],
  compact: ["ghost", "h-8 min-w-0 max-w-full shrink px-2 text-xs"],
  settings: ["outline", "h-11 w-full max-w-sm justify-between px-3"],
} as const;

function getThinkingHint(
  effort: AiReasoningEffort,
  preference: AiReasoningEffort,
): string {
  if (effort !== preference) {
    return `Using ${getAiReasoningLabel(effort).toLowerCase()} for this model. Your ${getAiReasoningLabel(preference).toLowerCase()} preference is saved.`;
  }
  return "More thinking gives the model more time to work through a task.";
}

export function AiModelPicker({
  variant = "settings",
  modelDraft,
  onModelSelect,
  onCustomModelSelect,
}: AiModelPickerProps) {
  const { config, customConfig, update } = useAiProviderSettings();
  const [view, setView] = useState<"closed" | "thinking" | "models" | "custom">(
    "closed",
  );
  const [customModelId, setCustomModelId] = useState("");
  const open = view !== "closed";
  const selectingModel = view === "models";
  const editingCustomModel = view === "custom";
  const modelIcon =
    selectingModel || editingCustomModel ? "ChevronLeft" : "ChevronDown";
  const [buttonVariant, triggerClassName] = TRIGGER_STYLES[variant];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dismissedOutsideRef = useRef(false);
  const focusRef = useRef<HTMLButtonElement>(null);
  const customModelRef = useRef<HTMLInputElement>(null);
  const customActionRef = useRef<HTMLButtonElement>(null);
  const returnToCustomActionRef = useRef(false);
  const thinkingHintId = useId();
  const modelDescriptionId = useId();
  const customModelInputId = useId();
  const model = modelDraft ?? config.model;
  const modelLabel = getAiModelLabel(model);
  const preference =
    customConfig.reasoningEffort ?? AI_CONFIG.defaultReasoningEffort;
  const levels = getAiModelReasoningLevels(model);
  const effort = getEffectiveReasoningEffort(model, preference);
  const effortLabel = effort ? getAiReasoningLabel(effort) : undefined;
  const selectedIndex = levels.findIndex((level) => level.value === effort);
  const configuredOptions = getAiModelOptions();
  const isConfiguredModel = configuredOptions.some(
    (option) => option.id === model,
  );
  const options =
    !model || isConfiguredModel
      ? configuredOptions
      : [{ id: model }, ...configuredOptions];

  useEffect(() => {
    if (view === "closed") return;
    if (view === "custom") {
      customModelRef.current?.focus();
    } else if (view === "models" && returnToCustomActionRef.current) {
      returnToCustomActionRef.current = false;
      customActionRef.current?.focus();
    } else {
      focusRef.current?.focus();
    }
  }, [view]);

  const backToModels = () => {
    returnToCustomActionRef.current = true;
    setView("models");
  };

  const selectCustomModel = () => {
    const nextModel = customModelId.trim();
    if (!nextModel) return;
    if (onCustomModelSelect) {
      onCustomModelSelect(nextModel);
    } else {
      update({ model: nextModel });
    }
    setView("closed");
  };

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

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
          aria-label={`AI model and thinking: ${modelLabel}${effortLabel ? `, ${effortLabel}` : ""}`}
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
          if (editingCustomModel) {
            event.preventDefault();
            backToModels();
            return;
          }
          if (!selectingModel) return;
          event.preventDefault();
          setView("thinking");
        }}
      >
        <BlockStack gap="2">
          <Button
            ref={selectingModel || editingCustomModel ? undefined : focusRef}
            type="button"
            variant="ghost"
            className="h-11 w-full justify-start gap-2 px-3"
            aria-label={
              editingCustomModel
                ? "Custom model: back to models"
                : selectingModel
                  ? "Models: back to model settings"
                  : `Choose a model: ${modelLabel}`
            }
            onClick={() => {
              if (editingCustomModel) backToModels();
              else setView(selectingModel ? "thinking" : "models");
            }}
          >
            <Icon name={modelIcon} size="sm" />
            {editingCustomModel
              ? "Custom model"
              : selectingModel
                ? "Models"
                : modelLabel}
          </Button>
          {editingCustomModel ? (
            <BlockStack gap="3" className="p-3">
              <Label htmlFor={customModelInputId}>Model ID</Label>
              <Input
                ref={customModelRef}
                id={customModelInputId}
                value={customModelId}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`${customModelInputId}-hint`}
                onChange={(event) => setCustomModelId(event.target.value)}
                onEnter={selectCustomModel}
              />
              <Paragraph
                id={`${customModelInputId}-hint`}
                size="xs"
                tone="subdued"
              >
                Enter the model ID from your provider.
              </Paragraph>
              <Button
                type="button"
                disabled={!customModelId.trim()}
                onClick={selectCustomModel}
              >
                Use model
              </Button>
            </BlockStack>
          ) : selectingModel ? (
            <div role="group" aria-label="Models">
              <BlockStack gap="2">
                {options.map((option, index) => (
                  <Button
                    key={option.id}
                    ref={option.id === model ? focusRef : undefined}
                    type="button"
                    variant="ghost"
                    aria-label={option.label ?? option.id}
                    aria-describedby={
                      option.description
                        ? `${modelDescriptionId}-${index}`
                        : undefined
                    }
                    aria-pressed={option.id === model}
                    className="h-auto w-full justify-between px-3 py-3 text-left whitespace-normal aria-[pressed=true]:bg-accent"
                    onClick={() => {
                      const isCustomModel = !configuredOptions.some(
                        (configuredOption) => configuredOption.id === option.id,
                      );
                      if (isCustomModel && onCustomModelSelect) {
                        onCustomModelSelect(option.id);
                      } else {
                        update({ model: option.id });
                        onModelSelect?.();
                      }
                      setView("thinking");
                    }}
                  >
                    <BlockStack as="span" gap="1">
                      {option.label ?? option.id}
                      {option.description && (
                        <Text
                          id={`${modelDescriptionId}-${index}`}
                          size="xs"
                          tone="subdued"
                        >
                          {option.description}
                        </Text>
                      )}
                    </BlockStack>
                    {option.id === model && (
                      <Icon name="Check" size="sm" className="shrink-0" />
                    )}
                  </Button>
                ))}
                <Button
                  ref={customActionRef}
                  type="button"
                  variant="ghost"
                  className="h-11 w-full justify-start gap-2 px-3"
                  onClick={() => {
                    setCustomModelId(isConfiguredModel ? "" : model);
                    setView("custom");
                  }}
                >
                  <Icon name="Plus" size="sm" />
                  Custom model…
                </Button>
              </BlockStack>
            </div>
          ) : effort ? (
            <BlockStack gap="4" className="p-3">
              <Text size="xs" weight="medium">
                Thinking: {effortLabel}
              </Text>
              <BlockStack gap="2">
                <Slider
                  className="cursor-pointer data-[disabled]:cursor-default"
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
              <Paragraph id={thinkingHintId} size="xs" tone="subdued">
                {getThinkingHint(effort, preference)}
              </Paragraph>
            </BlockStack>
          ) : null}
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
