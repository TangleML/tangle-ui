import { type ChangeEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  getPipelineTagsFromSpec,
  PIPELINE_TAGS_ANNOTATION,
  setComponentSpecAnnotation,
} from "@/utils/annotations";

const MAXIMUM_TAG_LENGTH = 20;

export const PipelineTagsEditor = () => {
  const { componentSpec, setComponentSpec } = useComponentSpec();

  const [isAdding, setIsAdding] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const tags = getPipelineTagsFromSpec(componentSpec);

  const saveTags = (updatedTags: string[]) => {
    const tagsString = updatedTags.filter(Boolean).join(",");
    setComponentSpec(
      setComponentSpecAnnotation(
        componentSpec,
        PIPELINE_TAGS_ANNOTATION,
        tagsString,
      ),
    );
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAXIMUM_TAG_LENGTH) {
      setNewTagValue(value);
    }
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAXIMUM_TAG_LENGTH) {
      setEditValue(value);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = newTagValue.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      saveTags([...tags, trimmedTag]);
    }

    setNewTagValue("");
    setIsAdding(false);
  };

  const handleRemoveTag = (index: number) => {
    const updatedTags = tags.filter((_, i) => i !== index);
    saveTags(updatedTags);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(tags[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const trimmedValue = editValue.trim();
      const isDuplicate = tags.some(
        (tag, idx) => tag === trimmedValue && idx !== editingIndex,
      );

      if (!isDuplicate) {
        const updatedTags = [...tags];
        updatedTags[editingIndex] = trimmedValue;
        saveTags(updatedTags);
      }
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  return (
    <BlockStack gap="2">
      {isAdding ? (
        <InlineStack gap="2" align="center">
          <Input
            autoFocus
            value={newTagValue}
            onChange={handleInputChange}
            onBlur={handleAddTag}
            onEnter={handleAddTag}
            onEscape={() => {
              setNewTagValue("");
              setIsAdding(false);
            }}
            placeholder="Enter tag name..."
            className="h-7 text-xs w-36"
          />
          <Text
            tone={
              newTagValue.length === MAXIMUM_TAG_LENGTH ? "critical" : "subdued"
            }
            size="xs"
          >
            {newTagValue.length}/{MAXIMUM_TAG_LENGTH}
          </Text>
        </InlineStack>
      ) : (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setIsAdding(true)}
          className="my-0.5"
        >
          <Icon name="Plus" size="sm" />
          Add Tag
        </Button>
      )}

      {tags.length > 0 && (
        <InlineStack gap="2" wrap="wrap">
          {tags.map((tag, index) =>
            editingIndex === index ? (
              <InlineStack key={index} gap="2" align="center">
                <Input
                  autoFocus
                  value={editValue}
                  onChange={handleEditChange}
                  onBlur={handleSaveEdit}
                  onEnter={handleSaveEdit}
                  onEscape={handleCancelEdit}
                  className="h-7 text-xs w-36"
                />
                <Text
                  tone={
                    editValue.length === MAXIMUM_TAG_LENGTH
                      ? "critical"
                      : "subdued"
                  }
                  size="xs"
                >
                  {editValue.length}/{MAXIMUM_TAG_LENGTH}
                </Text>
              </InlineStack>
            ) : (
              <Badge
                key={tag}
                size="sm"
                shape="rounded"
                variant="outline"
                className="has-[button:hover]:opacity-100 cursor-pointer hover:opacity-80"
                onClick={() => handleStartEdit(index)}
              >
                {tag}
                <Button
                  size="min"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(index);
                  }}
                  className="rounded-full p-0.5 hover:text-destructive hover:bg-transparent"
                >
                  <Icon name="X" size="sm" />
                </Button>
              </Badge>
            ),
          )}
        </InlineStack>
      )}
    </BlockStack>
  );
};
