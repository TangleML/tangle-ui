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
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";

import { entityIcon, entityLabel } from "./resourceEntities";

export const UNTITLED = "Untitled";

interface ResourceCardProps {
  resource: ProjectResourceSummary;
  onRemove: (resource: ProjectResourceSummary) => void;
}

export function ResourceCard({ resource, onRemove }: ResourceCardProps) {
  const name = resource.name ?? UNTITLED;

  return (
    <div className="relative rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50">
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
          {resource.name ? (
            <Text weight="medium" className="truncate">
              {name}
            </Text>
          ) : (
            <Text weight="medium" tone="subdued" className="truncate">
              {UNTITLED}
            </Text>
          )}
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
            className="absolute right-2 top-2"
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
