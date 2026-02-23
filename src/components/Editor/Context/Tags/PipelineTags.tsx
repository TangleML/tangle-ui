import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  getPipelineTagsFromSpec,
  PIPELINE_TAGS_ANNOTATION,
  setComponentSpecAnnotation,
} from "@/utils/annotations";

import { Tag } from "./Tag";
import { TagEditor } from "./TagEditor";

const TAG_LIMIT = 10;

export const PipelineTags = () => {
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

  const handleAddTag = () => {
    const trimmedTag = newTagValue.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < TAG_LIMIT) {
      saveTags([...tags, trimmedTag]);
    }
    setNewTagValue("");
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setNewTagValue("");
    setIsAdding(false);
  };

  const handleRemoveTag = (index: number) => {
    saveTags(tags.filter((_, i) => i !== index));
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
      {tags.length >= TAG_LIMIT ? (
        <Paragraph size="xs" tone="subdued">
          Tag limit reached ({TAG_LIMIT})
        </Paragraph>
      ) : isAdding ? (
        <TagEditor
          value={newTagValue}
          onChange={setNewTagValue}
          onSave={handleAddTag}
          onCancel={handleCancelAdd}
        />
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
              <TagEditor
                key={index}
                value={editValue}
                onChange={setEditValue}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
            ) : (
              <Tag
                key={tag}
                tag={tag}
                onEdit={() => handleStartEdit(index)}
                onRemove={() => handleRemoveTag(index)}
              />
            ),
          )}
        </InlineStack>
      )}
    </BlockStack>
  );
};
