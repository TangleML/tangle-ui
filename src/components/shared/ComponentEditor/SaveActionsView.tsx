import type { ReactNode } from "react";

import { DiffSection } from "@/components/shared/ComponentDiff/DiffSection";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { type EntityDiff, hasIODiff } from "@/utils/componentSpecDiff";

type ChooseableAction = "update" | "import" | "place";

export interface SaveActionsViewProps {
  taskName: string;
  inputDiff: EntityDiff<{ name: string }>;
  outputDiff: EntityDiff<{ name: string }>;
  /** Whether to offer "Place as a new task". */
  allowPlace?: boolean;
  /** Extra content shown above the actions (e.g. v2 predicted issues + preview). */
  children?: ReactNode;
  onChoose: (action: ChooseableAction) => void;
}

/**
 * The full-area "Apply your edit" interface shown inside the component editor's
 * fullscreen surface (rendered by `ComponentEditorDialog` when the user hits
 * Save). It is plain in-flow content — NOT a portalled modal — so it lives in
 * the editor's stacking context rather than behind it. The editor owns the
 * Back affordance and title chrome.
 */
export function SaveActionsView({
  taskName,
  inputDiff,
  outputDiff,
  allowPlace = false,
  children,
  onChoose,
}: SaveActionsViewProps) {
  const showDiff = hasIODiff(inputDiff, outputDiff);

  return (
    <div className="mx-auto w-full max-w-xl overflow-y-auto p-4">
      <BlockStack gap="4">
        <Text tone="subdued">
          Choose what to do with your changes to “{taskName}”.
        </Text>

        {showDiff && (
          <BlockStack gap="2">
            <DiffSection label="Input" diff={inputDiff} />
            <DiffSection label="Output" diff={outputDiff} />
          </BlockStack>
        )}

        {children}

        <BlockStack gap="2">
          <ActionRow
            icon="RefreshCw"
            title="Update this task"
            description="Apply the edit to this task"
            onClick={() => onChoose("update")}
            autoFocus
          />
          <ActionRow
            icon="Download"
            title="Import to library"
            description="Save as a new reusable component"
            onClick={() => onChoose("import")}
          />
          {allowPlace && (
            <ActionRow
              icon="Plus"
              title="Place as a new task"
              description="Keep this task; add a new one nearby"
              onClick={() => onChoose("place")}
            />
          )}
        </BlockStack>
      </BlockStack>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  description,
  onClick,
  autoFocus,
}: {
  icon: IconName;
  title: string;
  description: string;
  onClick: () => void;
  autoFocus?: boolean;
}) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-3 p-3"
      onClick={onClick}
      autoFocus={autoFocus}
    >
      <Icon name={icon} size="sm" className="shrink-0 text-muted-foreground" />
      <span className="flex flex-col items-start gap-0.5 text-left">
        <Text size="sm" weight="semibold">
          {title}
        </Text>
        <Text size="xs" tone="subdued">
          {description}
        </Text>
      </span>
    </Button>
  );
}
