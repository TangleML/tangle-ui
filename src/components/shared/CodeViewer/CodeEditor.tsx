import MonacoEditor from "@monaco-editor/react";

import { useMonacoTheme } from "@/hooks/useMonacoTheme";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

function CodeEditor({ value, language, onChange, readOnly }: CodeEditorProps) {
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
      }}
    />
  );
}

export default CodeEditor;
