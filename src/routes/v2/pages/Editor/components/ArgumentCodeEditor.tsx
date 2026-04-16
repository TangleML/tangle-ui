import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

import { DEFAULT_MONACO_OPTIONS } from "@/components/shared/ComponentEditor/constants";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, InputSpec, Task } from "@/models/componentSpec";
import type { TypeSpecType } from "@/models/componentSpec/entities/types";

import { useArgumentActions } from "./ArgumentRow/useArgumentActions";

const LANGUAGE_OPTIONS = [
  { value: "plaintext", label: "Plain Text" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
  { value: "shell", label: "Shell" },
] as const;

function getLanguageForType(type?: TypeSpecType): string {
  if (typeof type === "string") {
    const lower = type.toLowerCase();
    if (lower === "json" || lower === "jsonarray") return "json";
    if (lower === "yaml") return "yaml";
    if (lower === "python") return "python";
  }
  if (typeof type === "object") return "json";
  return "plaintext";
}

function serializeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== undefined && value !== null)
    return JSON.stringify(value, null, 2);
  return "";
}

interface ArgumentCodeEditorProps {
  inputSpec: InputSpec;
  currentValue: unknown;
  task: Task;
  spec: ComponentSpec;
}

export function ArgumentCodeEditor({
  inputSpec,
  currentValue,
  task,
  spec,
}: ArgumentCodeEditorProps) {
  const { setArgument, removeArgument } = useArgumentActions();
  const autoLanguage = getLanguageForType(inputSpec.type);
  const [language, setLanguage] = useState(autoLanguage);
  const [editorValue, setEditorValue] = useState(() =>
    serializeValue(currentValue),
  );

  useEffect(() => {
    setLanguage(getLanguageForType(inputSpec.type));
  }, [inputSpec.type]);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setEditorValue(serializeValue(currentValue));
  }, [currentValue]);

  useEffect(() => {
    editorRef.current?.focus();
  }, [inputSpec.name]);

  const handleMount = (editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
    editorInstance.focus();
  };

  const handleChange = (value: string | undefined) => {
    const text = value ?? "";
    setEditorValue(text);

    const trimmed = text.trim();
    if (trimmed === "") {
      removeArgument(task, inputSpec.name);
    } else {
      setArgument(spec, task.$id, inputSpec.name, trimmed);
    }
  };

  return (
    <BlockStack className="min-h-0 flex-1">
      <InlineStack
        gap="2"
        blockAlign="center"
        align="start"
        className="shrink-0 px-2 py-1 border-b border-gray-200 bg-gray-100 w-full"
      >
        <Text size="xs" weight="semibold" className="text-gray-700">
          {inputSpec.name}
        </Text>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-6 text-xs px-2 py-0 min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InlineStack>

      <BlockStack className="relative min-h-0 flex-1" align="stretch">
        <MonacoEditor
          language={language}
          theme="vs-dark"
          value={editorValue}
          onChange={handleChange}
          onMount={handleMount}
          options={DEFAULT_MONACO_OPTIONS}
        />
      </BlockStack>
    </BlockStack>
  );
}
