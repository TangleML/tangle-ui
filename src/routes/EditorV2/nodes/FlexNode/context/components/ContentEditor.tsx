import { type ChangeEvent, useEffect, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextSizeSelector } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/TextSizeSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { FONT_SIZE_MD, FONT_SIZE_SM } from "@/utils/constants";

export interface ContentEditorValue {
  title: string;
  content: string;
  titleFontSize?: number;
  contentFontSize?: number;
}

interface ContentEditorProps {
  value: ContentEditorValue;
  onChange: (updates: Partial<ContentEditorValue>) => void;
  readOnly: boolean;
}

export function ContentEditor({
  value,
  onChange,
  readOnly,
}: ContentEditorProps) {
  const [title, setTitle] = useState(value.title);
  const [content, setContent] = useState(value.content);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const saveChanges = () => {
    onChange({ title, content });
  };

  useEffect(() => {
    setTitle(value.title);
    setContent(value.content);
  }, [value.title, value.content]);

  if (readOnly) {
    return (
      <KeyValueList
        title="Content"
        items={[
          { label: "Title", value: value.title, copyable: true },
          { label: "Note", value: value.content, copyable: true },
        ]}
      />
    );
  }

  return (
    <ContentBlock title="Content">
      <BlockStack gap="2">
        <BlockStack>
          <InlineStack
            gap="4"
            align="space-between"
            blockAlign="end"
            wrap="nowrap"
            fill
          >
            <Label
              htmlFor="flex-node-title"
              className="text-muted-foreground text-xs"
            >
              Title
            </Label>
            <TextSizeSelector
              value={value.titleFontSize ?? FONT_SIZE_MD}
              onChange={(newSize) => onChange({ titleFontSize: newSize })}
              className="mb-1"
            />
          </InlineStack>
          <Input
            id="flex-node-title"
            value={title}
            onChange={handleTitleChange}
            onBlur={saveChanges}
            className="text-sm"
          />
        </BlockStack>
        <BlockStack>
          <InlineStack
            gap="4"
            align="space-between"
            blockAlign="end"
            wrap="nowrap"
            fill
          >
            <Label
              htmlFor="flex-node-content"
              className="text-muted-foreground text-xs"
            >
              Note
            </Label>
            <TextSizeSelector
              value={value.contentFontSize ?? FONT_SIZE_SM}
              onChange={(newSize) => onChange({ contentFontSize: newSize })}
              className="mb-1"
            />
          </InlineStack>
          <Textarea
            id="flex-node-content"
            value={content}
            onChange={handleContentChange}
            onBlur={saveChanges}
            className="text-xs"
          />
        </BlockStack>
      </BlockStack>
    </ContentBlock>
  );
}
