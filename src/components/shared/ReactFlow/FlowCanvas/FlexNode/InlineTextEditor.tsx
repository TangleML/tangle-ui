import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InlineTextEditorProps {
  value: string;
  placeholder?: string;
  textSize?: number;
  className?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const InlineTextEditor = ({
  value,
  placeholder = "Enter text...",
  textSize,
  className,
  onSave,
  onCancel,
}: InlineTextEditorProps) => {
  const [text, setText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    if (text !== value) {
      onSave(text);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setText(value);
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSave(text);
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      value={text}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-h-10 resize-none nodrag nopan focus-visible:ring-0 focus-visible:border-0 focus-visible:text-xs text-xs shadow-none p-0 rounded-none",
        className,
      )}
      style={{ fontSize: textSize }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />
  );
};
