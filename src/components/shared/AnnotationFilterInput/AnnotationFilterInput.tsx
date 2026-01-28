import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";

interface EditableAnnotationBadgeProps {
  filter: AnnotationFilter;
  onUpdate: (filter: AnnotationFilter) => void;
  onRemove: () => void;
}

function EditableAnnotationBadge({
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
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
        <button
          onClick={handleSave}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Save changes"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={handleCancel}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Cancel editing"
        >
          <X className="h-3 w-3" />
        </button>
      </InlineStack>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "cursor-default select-none transition-colors",
        "hover:bg-secondary/80",
      )}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {filter.key}
      {filter.value && `: ${filter.value}`}
      <button
        onClick={onRemove}
        className="ml-1 hover:text-destructive"
        aria-label={`Remove ${filter.key} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

interface AnnotationFilterInputProps {
  filters: AnnotationFilter[];
  onChange: (filters: AnnotationFilter[]) => void;
}

export function AnnotationFilterInput({
  filters,
  onChange,
}: AnnotationFilterInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [valueInput, setValueInput] = useState("");

  const handleAdd = () => {
    const trimmedKey = keyInput.trim();
    if (!trimmedKey) return;

    const trimmedValue = valueInput.trim();
    const newFilter: AnnotationFilter = trimmedValue
      ? { key: trimmedKey, value: trimmedValue }
      : { key: trimmedKey };

    onChange([...filters, newFilter]);
    setKeyInput("");
    setValueInput("");
    setIsExpanded(false);
  };

  const handleRemove = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updatedFilter: AnnotationFilter) => {
    const newFilters = [...filters];
    newFilters[index] = updatedFilter;
    onChange(newFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && keyInput.trim()) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") {
      setIsExpanded(false);
      setKeyInput("");
      setValueInput("");
    }
  };

  return (
    <InlineStack gap="2" align="start" blockAlign="center">
      <Text size="sm" tone="subdued">
        Annotations:
      </Text>

      {!isExpanded ? (
        <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Add filter
        </Button>
      ) : (
        <InlineStack gap="1" align="center">
          <Input
            placeholder="Key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-28 h-8 text-sm"
            autoFocus
          />
          <Input
            placeholder="Value (optional)"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-36 h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!keyInput.trim()}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsExpanded(false);
              setKeyInput("");
              setValueInput("");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </InlineStack>
      )}

      {filters.map((filter, index) => (
        <EditableAnnotationBadge
          key={index}
          filter={filter}
          onUpdate={(updated) => handleUpdate(index, updated)}
          onRemove={() => handleRemove(index)}
        />
      ))}
    </InlineStack>
  );
}
