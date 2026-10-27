import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import {
  type DashboardSection,
  SECTION_TYPES,
  type SectionType,
} from "./dashboardSections";
import { SectionHeader } from "./SectionHeader";

export interface DashboardWidgetProps {
  section: DashboardSection;
  editing: boolean;
  onChange: (section: DashboardSection) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  first: boolean;
  last: boolean;
}

interface FrameProps extends DashboardWidgetProps {
  children?: ReactNode;
  empty?: boolean;
  loading?: boolean;
  error?: string | null;
  unavailable?: string;
}

export function DashboardSectionFrame({
  section,
  editing,
  onChange,
  onRemove,
  onMove,
  first,
  last,
  empty,
  loading,
  error,
  unavailable,
  children,
}: FrameProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: section.id, disabled: !editing });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: section.id,
    disabled: !editing,
  });
  if (!editing && (unavailable || (empty && !loading && !error))) return null;
  const title = section.type
    ? SECTION_TYPES[section.type].title
    : "New section";

  return (
    <section
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      aria-label={title}
      data-dashboard-section={section.id}
      data-width={section.width}
      className={cn(
        "@container/dashboard-section min-w-0 grow space-y-3",
        section.width === 1
          ? "basis-[calc((100%-3rem)/3)]"
          : section.width === 2
            ? "basis-[calc((200%-1.5rem)/3)]"
            : "basis-full",
        "min-w-[min(100%,16rem)]",
        editing &&
          "rounded-xl border border-dashed border-border bg-muted/10 p-3",
        isOver && !isDragging && "border-primary bg-primary/5",
        isDragging && "opacity-30",
      )}
    >
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Move ${title}`}
            {...attributes}
            {...listeners}
          >
            <Icon name="GripVertical" size="sm" />
          </Button>
          <Select
            value={section.type ?? ""}
            onValueChange={(type) =>
              onChange({ ...section, type: type as SectionType })
            }
          >
            <SelectTrigger
              autoFocus={!section.type}
              aria-label="Section content"
              className="h-8 min-w-0 flex-1 text-xs"
            >
              <SelectValue placeholder="Choose content…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SECTION_TYPES).map(([type, { title }]) => (
                <SelectItem key={type} value={type}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipButton
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            wrapperClassName="shrink-0"
            tooltip="Remove section"
            aria-label={`Remove ${title} section`}
            onClick={onRemove}
          >
            <Icon name="Trash" size="sm" />
          </TooltipButton>
          <div className="flex w-full items-center justify-between gap-2 border-t border-border/60 pt-2">
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`${title} order`}
            >
              <TooltipButton
                variant="ghost"
                size="icon"
                className="size-7"
                tooltip="Move left"
                aria-label={`Move ${title} left`}
                disabled={first}
                onClick={() => onMove(-1)}
              >
                <Icon name="ArrowLeft" size="sm" />
              </TooltipButton>
              <TooltipButton
                variant="ghost"
                size="icon"
                className="size-7"
                tooltip="Move right"
                aria-label={`Move ${title} right`}
                disabled={last}
                onClick={() => onMove(1)}
              >
                <Icon name="ArrowRight" size="sm" />
              </TooltipButton>
            </div>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`${title} width`}
            >
              <Text size="xs" tone="subdued" className="mr-1">
                Width
              </Text>
              {([1, 2, 3] as const).map((width) => (
                <Button
                  key={width}
                  variant={section.width === width ? "secondary" : "ghost"}
                  size="xs"
                  aria-pressed={section.width === width}
                  onClick={() => onChange({ ...section, width })}
                >
                  {width === 1 ? "⅓" : width === 2 ? "⅔" : "Full"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        section.type && (
          <SectionHeader
            title={title}
            viewAllTo={SECTION_TYPES[section.type].to}
          />
        )
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Spinner />
          Loading…
        </div>
      ) : error ? (
        <Text role="alert" size="sm" tone="subdued">
          {error}
        </Text>
      ) : unavailable || empty || !section.type ? (
        <div className="flex min-h-28 items-center justify-center rounded-lg bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {unavailable ??
            (section.type
              ? "No items yet. This section hides until there’s something to show."
              : "Choose what you’d like to see here.")}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
