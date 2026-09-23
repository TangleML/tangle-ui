import { useId } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import {
  getAiModelLabel,
  getAiModelOptions,
  getDefaultAiModelId,
} from "@/config/aiModels";
import { cn } from "@/lib/utils";

const PROVIDER_DEFAULT_VALUE = "__provider_default__";

interface AiModelSelectProps {
  value: string;
  onValueChange: (modelId: string) => void;
  allowProviderDefault?: boolean;
  appearance?: "header" | "field";
  ariaLabel?: string;
  id?: string;
}

export function AiModelSelect({
  value,
  onValueChange,
  allowProviderDefault = false,
  appearance = "field",
  ariaLabel = "AI model",
  id,
}: AiModelSelectProps) {
  const descriptionId = useId();
  const options = getAiModelOptions();
  const selectedModel =
    value.trim() || (allowProviderDefault ? "" : getDefaultAiModelId());
  const selectedLabel = getAiModelLabel(selectedModel);
  const hasCustomModel =
    selectedModel && options.every((option) => option.id !== selectedModel);
  const choices = [
    ...(allowProviderDefault
      ? [
          {
            id: PROVIDER_DEFAULT_VALUE,
            label: "Provider default",
            description: "Let your provider choose the model.",
          },
        ]
      : []),
    ...(hasCustomModel
      ? [
          {
            id: selectedModel,
            label: selectedLabel,
            description: "Your configured model.",
          },
        ]
      : []),
    ...options,
  ];

  return (
    <Select
      value={selectedModel || PROVIDER_DEFAULT_VALUE}
      onValueChange={(nextValue) => {
        // Radix's hidden form select can emit an empty value when custom options change.
        if (nextValue) {
          onValueChange(nextValue === PROVIDER_DEFAULT_VALUE ? "" : nextValue);
        }
      }}
    >
      <SelectTrigger
        id={id}
        type="button"
        aria-label={ariaLabel}
        title={`AI model: ${selectedLabel}`}
        className={cn(
          "group gap-2 rounded-full transition-colors motion-reduce:transition-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1",
          appearance === "header"
            ? "hidden h-8 max-w-52 border-white/15 bg-white/5 pr-2.5 pl-1.5 text-xs text-white shadow-none hover:border-violet-300/50 hover:bg-white/10 focus-visible:ring-violet-300/50 lg:flex [&_svg]:text-white/70"
            : "h-10 w-full border-brand/20 bg-brand/5 pr-3 pl-2 hover:border-brand/40 hover:bg-brand/10 sm:w-56",
        )}
      >
        <InlineStack
          as="span"
          align="center"
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full bg-linear-to-br from-violet-400 via-brand to-indigo-500 text-white shadow-sm"
        >
          <Icon name="Workflow" size="sm" className="text-white" />
        </InlineStack>
        <SelectValue>
          <Text size="sm" weight="medium" className="truncate text-inherit">
            {selectedLabel}
          </Text>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)] rounded-3xl border-brand/20 bg-linear-to-br from-brand/10 via-popover to-popover p-2 shadow-xl motion-reduce:animate-none [&_[data-slot=select-item]>span:first-child]:right-4"
      >
        <SelectGroup>
          <SelectLabel className="px-3 pt-2 pb-4">
            <InlineStack gap="2" blockAlign="center">
              <Icon
                name="Workflow"
                size="sm"
                className="text-violet-500 dark:text-violet-300"
                aria-hidden="true"
              />
              <Text
                size="xs"
                weight="semibold"
                className="tracking-widest uppercase"
              >
                Tangle AI
              </Text>
            </InlineStack>
            <Text size="xs" tone="subdued" className="mt-1.5 block">
              Choose your model
            </Text>
          </SelectLabel>
          {choices.map((option, index) => {
            const label = option.label ?? option.id;
            return (
              <SelectItem
                key={option.id}
                value={option.id}
                textValue={label}
                aria-labelledby={`${descriptionId}-${index}-label`}
                aria-describedby={`${descriptionId}-${index}`}
                className="mb-1 cursor-pointer rounded-2xl border border-transparent py-3 pr-10 pl-3 transition-colors focus:border-brand/30 focus:bg-brand/10 data-[state=checked]:border-brand/20 data-[state=checked]:bg-brand/10 motion-reduce:transition-none dark:focus:bg-brand/20 dark:data-[state=checked]:bg-brand/20"
              >
                <BlockStack as="span" gap="1" className="min-w-0">
                  <Text
                    id={`${descriptionId}-${index}-label`}
                    size="sm"
                    weight="medium"
                    className="break-all"
                  >
                    {label}
                  </Text>
                  <Text
                    id={`${descriptionId}-${index}`}
                    size="xs"
                    tone="subdued"
                    className="break-words"
                  >
                    {option.description ?? option.id}
                  </Text>
                </BlockStack>
              </SelectItem>
            );
          })}
        </SelectGroup>
        <Text size="xs" tone="subdued" className="block px-3 pt-2 pb-1">
          Availability depends on your provider.
        </Text>
      </SelectContent>
    </Select>
  );
}
