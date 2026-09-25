import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { removingDestroys, resourceKindLabel } from "./resourceEntities";

export const UNTITLED = "Untitled";

interface ResourceRowProps {
  resource: ProjectResourceSummary;
  selected: boolean;
  onSelect: (resource: ProjectResourceSummary) => void;
  onRemove: (resource: ProjectResourceSummary) => void;
}

export function ResourceRow({
  resource,
  selected,
  onSelect,
  onRemove,
}: ResourceRowProps) {
  const name = resource.name ?? UNTITLED;
  const destroys = removingDestroys(resource);
  const kindLabel = resourceKindLabel(resource);

  return (
    <TableRow
      className="relative"
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="max-w-0 overflow-hidden">
        <InlineStack
          gap="2"
          blockAlign="center"
          wrap="nowrap"
          className="w-full"
        >
          {/* The pseudo-element makes the whole row the button's hit area
              without swallowing the remove button beside it. */}
          <button
            type="button"
            onClick={() => onSelect(resource)}
            aria-pressed={selected}
            className="min-w-0 cursor-pointer truncate text-left after:absolute after:inset-0"
            {...tracking("projects.preview_resource")}
          >
            <Text
              size="sm"
              weight={selected ? "medium" : "regular"}
              tone={resource.name ? "inherit" : "subdued"}
            >
              {name}
            </Text>
          </button>

          {kindLabel && (
            <Badge size="sm" variant="secondary">
              {kindLabel}
            </Badge>
          )}
        </InlineStack>
      </TableCell>

      <TableCell className="text-right">
        <Text size="xs" tone="subdued">
          {formatDate(resource.createdAt)}
        </Text>
      </TableCell>

      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(resource)}
          className={cn(
            "relative z-10 size-7 text-muted-foreground",
            destroys ? "hover:text-destructive" : "hover:text-foreground",
          )}
          aria-label={
            destroys ? `Delete ${name}` : `Remove ${name} from this project`
          }
          title={
            destroys ? `Delete ${name}` : `Remove ${name} from this project`
          }
          {...tracking("projects.remove_resource_open")}
        >
          <Icon name={destroys ? "Trash2" : "X"} size="sm" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
