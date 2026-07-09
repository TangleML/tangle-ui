import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { FullscreenElement } from "../FullscreenElement";
import CodeSyntaxHighlighter from "./CodeSyntaxHighlighter";

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  fullscreen?: boolean;
  scrollToBottom?: boolean;
  onClose?: () => void;
}

const DEFAULT_CODE_VIEWER_HEIGHT = 128;

const CodeViewer = ({
  code,
  language = "yaml",
  filename = "",
  fullscreen = false,
  scrollToBottom = false,
  onClose,
}: CodeViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);

  const handleToggleFullscreen = () => {
    if (isFullscreen && onClose) {
      onClose();
    }

    setIsFullscreen((prev) => !prev);
  };

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (isFullscreen && e.key === "Escape") {
        setIsFullscreen(false);
        onClose?.();
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
      <div className="flex flex-col transition-shadow duration-150 bg-card h-full rounded-md">
        <div className="flex items-center justify-between gap-2 bg-muted sticky top-0 z-10 rounded-t-md px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base text-foreground">
              {filename}
            </span>
            <span className="text-sm text-muted-foreground">(Read Only)</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleFullscreen}
            className="text-muted-foreground hover:text-foreground"
            title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? <Icon name="X" /> : <Icon name="Maximize2" />}
          </Button>
        </div>
        <div className="flex-1 relative">
          <div
            className="absolute inset-0 overflow-y-auto bg-card"
            style={{
              willChange: "transform",
              minHeight: DEFAULT_CODE_VIEWER_HEIGHT,
            }}
          >
            <CodeSyntaxHighlighter
              code={code}
              language={language}
              scrollToBottom={scrollToBottom}
            />
          </div>
        </div>
      </div>
    </FullscreenElement>
  );
};

export default CodeViewer;
