import { type ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

const MAXIMUM_TAG_LENGTH = 20;

interface TagEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const TagEditor = ({
  value,
  onChange,
  onSave,
  onCancel,
}: TagEditorProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= MAXIMUM_TAG_LENGTH) {
      onChange(e.target.value);
    }
  };

  return (
    <InlineStack gap="2" align="center">
      <Input
        autoFocus
        value={value}
        onChange={handleChange}
        onBlur={onSave}
        onEnter={onSave}
        onEscape={onCancel}
        placeholder="Enter tag name..."
        className="h-7 text-xs w-36"
      />
      <Text
        tone={value.length === MAXIMUM_TAG_LENGTH ? "critical" : "subdued"}
        size="xs"
      >
        {value.length}/{MAXIMUM_TAG_LENGTH}
      </Text>
    </InlineStack>
  );
};
