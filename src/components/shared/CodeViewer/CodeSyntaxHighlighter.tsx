import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { memo, type MouseEvent } from "react";

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

  // Stop mousedown propagation to prevent parent containers (like Window)
  // from triggering re-renders during Monaco's focus handling
  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div onMouseDown={handleMouseDown} className="h-full w-full">
      <MonacoEditor
        language={language}
        theme="vs-dark"
        value={code}
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
    </div>
  );
});

export default CodeSyntaxHighlighter;
