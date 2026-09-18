import { Button } from "@/components/ui/button";
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
            without swallowing the remove button beside it. */}
        <button
          type="button"
          onClick={() => onSelect(resource)}
          aria-pressed={selected}
          className="block w-full cursor-pointer truncate text-left after:absolute after:inset-0"
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

      <TableCell className="w-28 text-right">
        <Text size="xs" tone="subdued">
          {formatDate(resource.createdAt)}
        </Text>
      </TableCell>

      <TableCell className="w-8 pr-0">
        {/* An X, not a bin: this takes the item out of the project and leaves
            what it points at alone. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(resource)}
          className="relative z-10 size-7 text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${name} from this project`}
          title={`Remove ${name} from this project`}
          {...tracking("projects.remove_resource_open")}
        >
          <Icon name="X" size="sm" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
