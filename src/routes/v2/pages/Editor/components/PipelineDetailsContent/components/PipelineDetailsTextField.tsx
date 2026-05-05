import {
  type ChangeEvent,
  type FocusEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Heading } from "@/components/ui/typography";

interface PipelineDetailsTextFieldProps {
  title: string;
  id: string;
  placeholder: string;
  testId: string;
  initialValue: string;
  onCommit: (value: string | undefined) => void;
}

export function PipelineDetailsTextField({
  title,
  id,
  placeholder,
  testId,
  initialValue,
  onCommit,
}: PipelineDetailsTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialValue);

  useLayoutEffect(() => {
    if (textareaRef.current === document.activeElement) {
      return;
    }
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    onCommit(event.currentTarget.value || undefined);
  };

  return (
    <BlockStack gap="2">
      <Heading level={3}>{title}</Heading>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="min-h-16 resize-y text-xs!"
        data-testid={testId}
      />
    </BlockStack>
  );
}
