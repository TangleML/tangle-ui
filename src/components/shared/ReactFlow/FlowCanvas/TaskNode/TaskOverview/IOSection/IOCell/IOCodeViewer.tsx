import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { safeJsonParse } from "@/utils/string";

const MAX_LINES = 10;
const JSON_CODE_LINE_HEIGHT = 31;
const HEADER_HEIGHT = 55;

interface IOCodeViewerProps {
  title: string;
  value: string;
}

const IOCodeViewer = ({ title, value }: IOCodeViewerProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const { parsed, isValidJson } = safeJsonParse(value);

  if (!isValidJson) {
    return (
      <pre className="w-full font-mono text-xs whitespace-pre-line wrap-break-word">
        {value || "No value"}
      </pre>
    );
  }

  const codeString = JSON.stringify(parsed, null, 2);

  const lines = codeString.split("\n");
  const maxLines = Math.min(MAX_LINES, lines.length);
  const lineHeight = `${maxLines * JSON_CODE_LINE_HEIGHT + HEADER_HEIGHT}px`;

  return (
    <div style={{ height: lineHeight }}>
      <CodeViewer
        code={codeString}
        language="json"
        filename={title}
        isFullscreen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        onExpand={() => setIsFullScreen(true)}
      />
    </div>
  );
};

export default IOCodeViewer;
