import { Highlight, themes } from "prism-react-renderer";
import { memo } from "react";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  className?: string;
}

// Map common language names to Prism language identifiers
const languageMap: Record<string, string> = {
  yaml: "yaml",
  yml: "yaml",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  python: "python",
  py: "python",
  json: "json",
  bash: "bash",
  shell: "bash",
  sh: "bash",
};

/**
 * A lightweight read-only code block component using Prism for syntax highlighting.
 * Use this instead of CodeSyntaxHighlighter (Monaco) when you don't need editing
 * capabilities - it's faster, lighter, and has no focus/lifecycle issues.
 */
const CodeBlock = memo(function CodeBlock({
  code,
  language,
  showLineNumbers = true,
  className,
}: CodeBlockProps) {
  const prismLanguage = languageMap[language.toLowerCase()] ?? language;

  return (
    <Highlight theme={themes.vsDark} code={code.trim()} language={prismLanguage}>
      {({ className: prismClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            prismClassName,
            "h-full w-full overflow-auto m-0 p-3 text-sm font-mono",
            className,
          )}
          style={style}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line, key: i });
            return (
              <div
                key={i}
                {...lineProps}
                className={cn(lineProps.className, "table-row")}
              >
                {showLineNumbers && (
                  <span className="table-cell pr-4 text-right select-none opacity-50 text-xs">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token, key })} />
                  ))}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
});

export { CodeBlock };

