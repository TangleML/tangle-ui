import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";

interface EditableAnnotationBadgeProps {
  filter: AnnotationFilter;
  onUpdate: (filter: AnnotationFilter) => void;
  onRemove: () => void;
}

export function EditableAnnotationBadge({
  filter,
  onUpdate,
  onRemove,
}: EditableAnnotationBadgeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(filter.key);
  const [editValue, setEditValue] = useState(filter.value ?? "");
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      keyInputRef.current?.focus();
      keyInputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedKey = editKey.trim();
    if (!trimmedKey) {
      handleCancel();
      return;
    }

    const trimmedValue = editValue.trim();
    onUpdate(
      trimmedValue
        ? { key: trimmedKey, value: trimmedValue }
        : { key: trimmedKey },
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditKey(filter.key);
    setEditValue(filter.value ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleDoubleClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <InlineStack
        gap="1"
        align="center"
        className="animate-in fade-in-0 zoom-in-95"
      >
        <Input
          ref={keyInputRef}
          value={editKey}
          onChange={(e) => setEditKey(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 w-20 px-1.5 text-xs"
          placeholder="Key"
        />
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 w-24 px-1.5 text-xs"
          placeholder="Value"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className="size-5"
          aria-label="Save changes"
        >
          <Icon name="Check" size="xs" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="size-5 hover:text-destructive"
          aria-label="Cancel editing"
        >
          <Icon name="X" size="xs" />
        </Button>
      </InlineStack>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "cursor-default select-none transition-colors pr-1",
        "hover:bg-secondary/80",
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {filter.key}
      {filter.value && `: ${filter.value}`}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="ml-0.5 size-4 hover:text-destructive hover:bg-transparent"
        aria-label={`Remove ${filter.key} filter`}
      >
        <Icon name="X" size="xs" />
      </Button>
    </Badge>
  );
}
