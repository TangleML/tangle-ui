import { CodeViewer } from "@/components/shared/CodeViewer";
import { cn } from "@/lib/utils";
import { safeJsonParse } from "@/utils/string";

const MAX_LINES = 10;
const JSON_CODE_LINE_HEIGHT = 31;
const HEADER_HEIGHT = 55;

interface IOCodeViewerProps {
  title: string;
  value: string;
  /** Fill the available space instead of capping to a preview height. */
  isFullscreen?: boolean;
}

const IOCodeViewer = ({ title, value, isFullscreen }: IOCodeViewerProps) => {
  const { parsed, isValidJson } = safeJsonParse(value);

  if (!isValidJson) {
    return (
      <pre
        className={cn(
          "w-full font-mono text-xs whitespace-pre-line wrap-break-word",
          isFullscreen && "h-full overflow-auto",
        )}
      >
        {value || "No value"}
      </pre>
    );
  }

  const codeString = JSON.stringify(parsed, null, 2);

  const lines = codeString.split("\n");
  const maxLines = Math.min(MAX_LINES, lines.length);
  const lineHeight = `${maxLines * JSON_CODE_LINE_HEIGHT + HEADER_HEIGHT}px`;

  return (
    <div
      className={isFullscreen ? "h-full min-h-0 w-full" : undefined}
      style={isFullscreen ? undefined : { height: lineHeight }}
    >
      <CodeViewer code={codeString} language="json" filename={title} />
    </div>
  );
};

export default IOCodeViewer;
