import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

import { useMonacoTheme } from "@/hooks/useMonacoTheme";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  options?: editor.IStandaloneEditorConstructionOptions;
}

function CodeEditor({
  value,
  language,
  onChange,
  readOnly,
  options,
}: CodeEditorProps) {
  const monacoTheme = useMonacoTheme();

  return (
    <MonacoEditor
      language={language}
      theme={monacoTheme}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
        readOnly,
        ...options,
      }}
    />
  );
}

export default CodeEditor;
