import { type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  detectLanguage,
  isLanguageOption,
  LANGUAGE_OPTIONS,
} from "@/utils/detectLanguage";

import CodeEditor from "../CodeViewer/CodeEditor";

interface MultilineTextInputDialogProps {
  title: ReactNode;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  open: boolean;
  required?: boolean;
  maxLength?: number;
  highlightSyntax?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export const MultilineTextInputDialog = ({
  title,
  description,
  placeholder,
  initialValue = "",
  open,
  required = false,
  maxLength,
  highlightSyntax,
  onCancel,
  onConfirm,
}: MultilineTextInputDialogProps) => {
  const [value, setValue] = useState(initialValue);
  const [selectedLanguage, setSelectedLanguage] = useState(() =>
    detectLanguage(initialValue),
  );

  const handleConfirm = () => {
    onConfirm(value);
  };

  const handleCancel = () => {
    setValue(initialValue);
    onCancel();
  };

  const handleSelectValueChange = (v: string) => {
    if (isLanguageOption(v)) {
      setSelectedLanguage(v);
    }
  };

  const setCursorToEnd = (ref: HTMLTextAreaElement | null) => {
    if (ref && open) {
      ref.focus();
      ref.setSelectionRange(ref.value.length, ref.value.length);
    }
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setSelectedLanguage(detectLanguage(initialValue));
  }, [initialValue]);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <InlineStack gap="2" align="space-between" wrap="nowrap" fill>
          <DialogDescription className={cn(!description ? "hidden" : "")}>
            {description ?? title}
          </DialogDescription>
          {highlightSyntax && (
            <Select
              value={selectedLanguage}
              onValueChange={handleSelectValueChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </InlineStack>
        {highlightSyntax && selectedLanguage !== "plaintext" ? (
          <div className="h-64">
            <CodeEditor
              value={value}
              language={selectedLanguage}
              onChange={setValue}
            />
          </div>
        ) : (
          <Textarea
            ref={setCursorToEnd}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="min-h-32 max-h-[80vh]"
            required={required}
            maxLength={maxLength}
          />
        )}
        <DialogFooter>
          <InlineStack gap="2" align="space-between" className="w-full">
            {maxLength && value.length >= maxLength && (
              <Paragraph tone="warning" size="xs">
                Maximum length {maxLength} characters
              </Paragraph>
            )}
            <InlineStack
              gap="2"
              align="end"
              className={cn(!maxLength && "w-full")}
            >
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </InlineStack>
          </InlineStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
