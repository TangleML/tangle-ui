import { type ReactNode, useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { FullscreenElement } from "../FullscreenElement";
import CodeSyntaxHighlighter from "./CodeSyntaxHighlighter";
import { CodeViewerHeaderButton } from "./CodeViewerHeaderButton";

interface CodeViewerHeaderControls {
  exitFullscreen: () => void;
}

export type CodeViewerHeaderActions =
  ReactNode | ((controls: CodeViewerHeaderControls) => ReactNode);

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  fullscreen?: boolean;
  scrollToBottom?: boolean;
  allowFullscreen?: boolean;
  headerActions?: CodeViewerHeaderActions;
  onClose?: () => void;
}

const DEFAULT_CODE_VIEWER_HEIGHT = 128;

const CodeViewer = ({
  code,
  language = "yaml",
  filename = "",
  fullscreen = false,
  scrollToBottom = false,
  allowFullscreen = true,
  headerActions,
  onClose,
}: CodeViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);

  const exitFullscreen = () => {
    if (!isFullscreen) return;
    setIsFullscreen(false);
    onClose?.();
  };

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
        <div className="@container flex items-center justify-between gap-2 bg-muted sticky top-0 z-10 rounded-t-md px-3 py-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <Text weight="semibold" className="truncate min-w-0">
              {filename}
            </Text>
            <Text
              size="sm"
              tone="subdued"
              className="hidden @[22rem]:inline whitespace-nowrap"
            >
              (Read Only)
            </Text>
          </div>
          <InlineStack gap="1" className="shrink-0">
            {typeof headerActions === "function"
              ? headerActions({ exitFullscreen })
              : headerActions}
            {allowFullscreen && (
              <CodeViewerHeaderButton
                type="button"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "View fullscreen"
                }
              >
                {isFullscreen ? <Icon name="X" /> : <Icon name="Maximize2" />}
              </CodeViewerHeaderButton>
            )}
          </InlineStack>
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
