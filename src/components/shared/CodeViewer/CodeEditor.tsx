import MonacoEditor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

function CodeEditor({ value, language, onChange, readOnly }: CodeEditorProps) {
  return (
    <MonacoEditor
      language={language}
      theme="vs-dark"
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
