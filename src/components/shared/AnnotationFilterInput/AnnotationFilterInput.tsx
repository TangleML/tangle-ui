import type { KeyboardEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";

import { EditableAnnotationBadge } from "./EditableAnnotationBadge";

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
    const newFilter: AnnotationFilter = {
      key: trimmedKey,
      value: valueInput.trim() || undefined,
    };

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
          <Icon name="Plus" size="xs" className="mr-1" />
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
            aria-label="Cancel"
          >
            <Icon name="X" size="xs" />
          </Button>
        </InlineStack>
      )}

      {filters.map((filter, index) => (
        <EditableAnnotationBadge
          key={`annotation-${index}-${filter.key}`}
          filter={filter}
          onUpdate={(updated) => handleUpdate(index, updated)}
          onRemove={() => handleRemove(index)}
        />
      ))}
    </InlineStack>
  );
}
