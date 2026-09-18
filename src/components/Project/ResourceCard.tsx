import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { entityIcon, entityLabel } from "./resourceEntities";

export const UNTITLED = "Untitled";

interface ResourceCardProps {
  resource: ProjectResourceSummary;
  selected: boolean;
  onSelect: (resource: ProjectResourceSummary) => void;
  onRemove: (resource: ProjectResourceSummary) => void;
}

export function ResourceCard({
  resource,
  selected,
  onSelect,
  onRemove,
}: ResourceCardProps) {
  const name = resource.name ?? UNTITLED;

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-4 transition-colors",
        selected
          ? "border-primary bg-muted/60"
          : "border-border hover:bg-muted/50",
      )}
    >
      <BlockStack gap="2">
        <InlineStack
          gap="1"
          blockAlign="center"
          wrap="nowrap"
          className="w-full"
        >
          <Icon
            name={entityIcon(resource.entity)}
            size="xs"
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Text size="xs" tone="subdued" className="truncate">
            {entityLabel(resource.entity)}
          </Text>
        </InlineStack>

        <div className="pr-8">
          {/* The pseudo-element makes the whole card the button's hit area
              without nesting the actions menu inside a button. */}
          <button
            type="button"
            onClick={() => onSelect(resource)}
            aria-pressed={selected}
            className="w-full text-left after:absolute after:inset-0 after:rounded-lg"
            {...tracking("projects.preview_resource")}
          >
            <Text
              weight="medium"
              tone={resource.name ? "inherit" : "subdued"}
              className="truncate"
            >
              {name}
            </Text>
          </button>
        </div>

        <Text size="xs" tone="subdued" className="truncate">
          {`Added ${formatDate(resource.createdAt)}`}
        </Text>
      </BlockStack>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10"
            aria-label={`Item actions: ${name}`}
          >
            <Icon name="EllipsisVertical" size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => onRemove(resource)}
          >
            <Icon name="Trash2" size="sm" />
            Remove from project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
