import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Tag } from "@/components/Editor/Context/Tags/Tag";
import { TagEditor } from "@/components/Editor/Context/Tags/TagEditor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { PIPELINE_TAGS_ANNOTATION } from "@/utils/annotations";

const TAG_LIMIT = 10;

function parseTagsFromAnnotation(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

interface PipelineDetailsTagsProps {
  spec: ComponentSpec;
}

export const PipelineDetailsTags = observer(function PipelineDetailsTags({
  spec,
}: PipelineDetailsTagsProps) {
  const { updatePipelineTags } = usePipelineActions();
  const [isAdding, setIsAdding] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const tags = parseTagsFromAnnotation(
    spec.annotations.get(PIPELINE_TAGS_ANNOTATION),
  );

  const saveTags = (updatedTags: string[]) => {
    updatePipelineTags(spec, updatedTags);
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
          className="my-0.5 w-fit"
        >
          <Icon name="Plus" size="sm" />
          Add tag
        </Button>
      )}

      {tags.length > 0 && (
        <InlineStack gap="2" wrap="wrap">
          {tags.map((tag, index) =>
            editingIndex === index ? (
              <TagEditor
                key={`edit-${index}`}
                value={editValue}
                onChange={setEditValue}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
            ) : (
              <Tag
                key={`${tag}-${index}`}
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
});
