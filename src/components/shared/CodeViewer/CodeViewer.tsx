import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { FullscreenElement } from "../FullscreenElement";
import CodeSyntaxHighlighter from "./CodeSyntaxHighlighter";

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  isFullscreen: boolean;
  onClose: () => void;
  onExpand?: () => void;
}

const DEFAULT_CODE_VIEWER_HEIGHT = 128;

const CodeViewer = ({
  code,
  language = "yaml",
  filename = "",
  isFullscreen,
  onClose,
  onExpand,
}: CodeViewerProps) => {
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (isFullscreen && e.key === "Escape") {
        onClose();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isFullscreen]);

  const showFullscreenButton = (!isFullscreen && onExpand) || isFullscreen;

  return (
    <FullscreenElement fullscreen={isFullscreen}>
      <div className="flex flex-col transition-shadow duration-150 bg-slate-900 h-full rounded-md">
        <div className="flex items-center justify-between gap-2 bg-slate-800 sticky top-0 z-10 rounded-t-md px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base text-secondary">
              {filename}
            </span>
            <span className="text-sm text-secondary">(Read Only)</span>
          </div>
          {showFullscreenButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={isFullscreen ? onClose : onExpand}
              className="text-gray-200 hover:text-black"
              title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            >
              {isFullscreen ? <Icon name="X" /> : <Icon name="Maximize2" />}
            </Button>
          )}
        </div>
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
      </div>
    </FullscreenElement>
  );
};

export default CodeViewer;
