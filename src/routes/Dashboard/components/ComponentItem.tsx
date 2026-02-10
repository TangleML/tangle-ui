import { useEffect, useState } from "react";

import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { CopyYamlButton } from "@/components/shared/TaskDetails/Actions/CopyYamlButton";
import { DownloadPythonButton } from "@/components/shared/TaskDetails/Actions/DownloadPythonButton";
import { DownloadYamlButton } from "@/components/shared/TaskDetails/Actions/DownloadYamlButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentReference } from "@/utils/componentSpec";
import { isHydratedComponentReference } from "@/utils/componentSpec";

const SPEC_LIST_PREVIEW_COUNT = 4;

const SpecNameList = ({
  label,
  names,
  showAll,
  onToggleShowAll,
}: {
  label: string;
  names: string[];
  showAll: boolean;
  onToggleShowAll: () => void;
}) => {
  const visibleNames = showAll
    ? names
    : names.slice(0, SPEC_LIST_PREVIEW_COUNT);
  const hiddenCount = names.length - visibleNames.length;

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" align="space-between" blockAlign="center">
        <Text as="p" size="xs" weight="semibold" tone="subdued">
          {label} ({names.length})
        </Text>
        {names.length > SPEC_LIST_PREVIEW_COUNT && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggleShowAll();
            }}
          >
            {showAll ? "Show less" : `Show all (${names.length})`}
          </Button>
        )}
      </InlineStack>
      {names.length === 0 ? (
        <Text as="p" size="xs" tone="subdued">
          None
        </Text>
      ) : (
        <BlockStack gap="1">
          {visibleNames.map((n) => (
            <InlineStack key={n} gap="2" blockAlign="start">
              <Text as="span" size="xs" tone="subdued">
                •
              </Text>
              <Text as="p" size="xs" className="wrap-break-word">
                {n}
              </Text>
            </InlineStack>
          ))}
          {!showAll && hiddenCount > 0 && (
            <Text as="p" size="xs" tone="subdued">
              +{hiddenCount} more
            </Text>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
};

export const ComponentItem = ({
  component,
  isExpanded,
  onToggle,
}: {
  component: ComponentReference;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const name = component.spec?.name ?? component.name ?? "Unnamed";
  const spec = component.spec;
  const description = spec?.description;
  const inputCount = spec?.inputs?.length ?? 0;
  const outputCount = spec?.outputs?.length ?? 0;
  const isDeprecated = "deprecated" in component && !!component.deprecated;
  const inputNames =
    spec?.inputs?.map((input) => input.name).filter(Boolean) ?? [];
  const outputNames =
    spec?.outputs?.map((output) => output.name).filter(Boolean) ?? [];
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [showAllOutputs, setShowAllOutputs] = useState(false);

  const hydrated =
    "spec" in component && isHydratedComponentReference(component)
      ? component
      : undefined;

  useEffect(() => {
    if (!isExpanded) {
      setShowAllInputs(false);
      setShowAllOutputs(false);
    }
  }, [isExpanded]);

  const toggleShowAllInputs = () => setShowAllInputs((prev) => !prev);
  const toggleShowAllOutputs = () => setShowAllOutputs((prev) => !prev);

  return (
    <div
      className={cn(
        "relative z-0 w-full rounded-xl border border-transparent bg-transparent transition-all duration-200 ease-out",
        isExpanded
          ? "z-10 scale-[1.01] bg-violet-500/6 border-violet-500/10 shadow-[0_10px_24px_-12px_rgba(124,58,237,0.25)]"
          : "hover:bg-card/70 hover:border-border/60",
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <div className="shrink-0 rounded-lg bg-violet-500/10 p-1.5 text-violet-600 dark:text-violet-400">
          <Icon name="Box" size="sm" />
        </div>
        <BlockStack gap="0" className="min-w-0 flex-1 overflow-hidden">
          <InlineStack gap="2" blockAlign="center" className="overflow-hidden">
            <Text
              as="p"
              size="sm"
              weight="semibold"
              className="line-clamp-2 wrap-break-word"
            >
              {name}
            </Text>
            {isDeprecated && (
              <Text as="span" size="xs" tone="critical" className="shrink-0">
                deprecated
              </Text>
            )}
          </InlineStack>
          {description && (
            <Text
              as="p"
              size="xs"
              tone="subdued"
              className="mt-0.5 line-clamp-2"
            >
              {description}
            </Text>
          )}
        </BlockStack>
        <InlineStack gap="3" blockAlign="center" className="shrink-0">
          {inputCount > 0 && (
            <Text as="span" size="xs" tone="subdued">
              {inputCount} in
            </Text>
          )}
          {outputCount > 0 && (
            <Text as="span" size="xs" tone="subdued">
              {outputCount} out
            </Text>
          )}
        </InlineStack>
        <div className="shrink-0 text-muted-foreground">
          <Icon
            name="ChevronDown"
            size="sm"
            className={cn(
              "transition-transform duration-200 ease-out",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-3 pb-3 pt-2">
            <BlockStack gap="3" className="w-full">
              <SpecNameList
                label="Inputs"
                names={inputNames}
                showAll={showAllInputs}
                onToggleShowAll={toggleShowAllInputs}
              />
              <SpecNameList
                label="Outputs"
                names={outputNames}
                showAll={showAllOutputs}
                onToggleShowAll={toggleShowAllOutputs}
              />

              {hydrated && (
                <InlineStack
                  gap="1"
                  wrap="wrap"
                  className="border-t border-border/50 pt-1"
                >
                  <DownloadYamlButton componentRef={hydrated} />
                  {hydrated.spec.metadata?.annotations
                    ?.python_original_code && (
                    <DownloadPythonButton componentRef={hydrated} />
                  )}
                  <CopyYamlButton componentRef={hydrated} />
                  <ViewYamlButton componentRef={hydrated} />
                </InlineStack>
              )}
            </BlockStack>
          </div>
        </div>
      </div>
    </div>
  );
};
