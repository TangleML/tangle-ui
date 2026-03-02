import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { memo } from "react";

interface CodeSyntaxHighlighterProps {
  code: string;
  language: string;
  scrollToBottom?: boolean;
}

function revealLastLine(editor: editor.IStandaloneCodeEditor) {
  const lineCount = editor.getModel()?.getLineCount() ?? 1;
  editor.revealLine(lineCount);
}

const CodeSyntaxHighlighter = memo(function CodeSyntaxHighlighter({
  code,
  language,
  scrollToBottom = false,
}: CodeSyntaxHighlighterProps) {
  const handleMount = (editor: editor.IStandaloneCodeEditor) => {
    if (scrollToBottom) {
      revealLastLine(editor);
    }
  };

  return (
    <MonacoEditor
      key={code} // force re-render when code changes
      defaultLanguage={language}
      theme="vs-dark"
      defaultValue={code}
      onMount={handleMount}
      options={{
        readOnly: true,
        minimap: {
          enabled: false,
        },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
      }}
    />
  );
});

export default CodeSyntaxHighlighter;
