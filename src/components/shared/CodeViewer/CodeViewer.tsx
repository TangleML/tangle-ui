import { FileCode2, Maximize2, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import TooltipButton from "../Buttons/TooltipButton";
import { FullscreenElement } from "../FullscreenElement";
import CodeSyntaxHighlighter from "./CodeSyntaxHighlighter";

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  showInlineContent?: boolean;
}

const DEFAULT_CODE_VIEWER_HEIGHT = 128;

const CodeViewer = ({
  code,
  language = "yaml",
  filename = "",
  showInlineContent = true,
}: CodeViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shouldRenderInlineCode = showInlineContent || isFullscreen;

  const handleEnterFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const compactButton = (
    <TooltipButton
      type="button"
      variant="outline"
      size="icon"
      tooltip="View YAML"
      onClick={handleEnterFullscreen}
      aria-label="View YAML"
    >
      <FileCode2 className="size-4" />
    </TooltipButton>
  );

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (isFullscreen && e.key === "Escape") {
        setIsFullscreen(false);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isFullscreen]);

  return (
    <FullscreenElement fullscreen={isFullscreen}>
      <div
        className={cn(
          "flex flex-col transition-shadow duration-150",
          shouldRenderInlineCode ? "bg-slate-900 h-full rounded-md" : "bg-transparent",
        )}
      >
        {shouldRenderInlineCode ? (
          <div className="flex items-center justify-between gap-2 bg-slate-800 sticky top-0 z-10 rounded-t-md px-3 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-base text-secondary">{filename}</span>
              <span className="text-sm text-secondary">(Read Only)</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleEnterFullscreen}
              className="text-gray-200 hover:text-white"
              title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            >
              {isFullscreen ? <XIcon className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex">{compactButton}</div>
        )}
        {shouldRenderInlineCode && (
          <div className="flex-1 relative">
            <div
              className="absolute inset-0 overflow-y-auto bg-slate-900"
              style={{
                willChange: "transform",
                minHeight: DEFAULT_CODE_VIEWER_HEIGHT,
              }}
            >
              <CodeSyntaxHighlighter code={code} language={language} />
            </div>
          </div>
        )}
      </div>
    </FullscreenElement>
  );
};

export default CodeViewer;
