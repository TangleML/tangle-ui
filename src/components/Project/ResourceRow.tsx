import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

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

  return (
    <TableRow
      className="relative"
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="max-w-0 overflow-hidden">
        {/* The pseudo-element makes the whole row the button's hit area
            without nesting the actions menu inside a button. */}
        <button
          type="button"
          onClick={() => onSelect(resource)}
          aria-pressed={selected}
          className="block w-full truncate text-left after:absolute after:inset-0"
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
      </TableCell>

      <TableCell className="text-right">
        <Text size="xs" tone="subdued">
          {formatDate(resource.createdAt)}
        </Text>
      </TableCell>

      <TableCell className="w-8 pr-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 size-7"
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
      </TableCell>
    </TableRow>
  );
}
