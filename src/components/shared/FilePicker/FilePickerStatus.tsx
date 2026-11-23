import { useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { PickerStatus } from "./useFilePicker";

type FilePickerStatusPlacement = "inline" | "floating";

interface FilePickerStatusAnchor {
  x: number;
  y: number;
}

export interface FilePickerStatusProps {
  status: PickerStatus;
  errorTitle?: string;
  successTitle?: string;
  dismissible?: boolean;
  onDismiss: () => void;
  placement?: FilePickerStatusPlacement;
  anchor?: FilePickerStatusAnchor;
  className?: string;
}

const DEFAULT_ERROR_TITLE = "Import failed";
const DEFAULT_SUCCESS_TITLE = "Import successful";

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

export function FilePickerStatus({
  status,
  errorTitle = DEFAULT_ERROR_TITLE,
  successTitle = DEFAULT_SUCCESS_TITLE,
  dismissible = true,
  onDismiss,
  placement = "inline",
  anchor,
  className,
}: FilePickerStatusProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const isFloating = placement === "floating";
  const anchorX = anchor?.x;
  const anchorY = anchor?.y;

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!isFloating || !element) return;
    if (anchorX === undefined || anchorY === undefined) {
      element.style.removeProperty("left");
      element.style.removeProperty("top");
      return;
    }
    const parent = element.offsetParent;
    const maxLeft = (parent?.clientWidth ?? Infinity) - element.offsetWidth;
    const maxTop = (parent?.clientHeight ?? Infinity) - element.offsetHeight;
    element.style.left = `${clamp(anchorX, maxLeft)}px`;
    element.style.top = `${clamp(anchorY, maxTop)}px`;
  }, [isFloating, anchorX, anchorY, status]);

  if (status.kind === "idle") return null;

  const placementClass = isFloating
    ? cn(
        "absolute z-10 w-72 shadow-md",
        (anchorX === undefined || anchorY === undefined) && "top-3 right-3",
      )
    : undefined;

  if (status.kind === "reading") {
    return (
      <div
        ref={elementRef}
        className={cn(
          placementClass,
          isFloating && "rounded-md border bg-background p-3",
          className,
        )}
      >
        <Text size="xs" tone="subdued">
          Reading {status.fileName}…
        </Text>
      </div>
    );
  }

  const isError = status.kind === "error";
  const tone = isError ? "critical" : "success";

  const dismissButton = dismissible && (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Dismiss"
      onClick={onDismiss}
      className="shrink-0"
    >
      <Icon name="X" size="sm" />
    </Button>
  );

  const header = (
    <div className="flex items-start justify-between gap-2">
      <Heading level={4} tone={tone} size="md" className="font-medium mb-1">
        {status.title ?? (isError ? errorTitle : successTitle)}
      </Heading>
      {dismissButton}
    </div>
  );

  if (isError) {
    return (
      <div
        ref={elementRef}
        role="alert"
        className={cn(
          "border border-red-200 bg-red-50 p-3 rounded-md dark:border-red-500/30 dark:bg-red-950",
          placementClass,
          className,
        )}
      >
        {header}
        <Paragraph tone="critical" size="sm" className="whitespace-pre-wrap">
          {status.message}
        </Paragraph>
        {status.detail && (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-100/60 p-2 font-mono text-xs text-destructive dark:bg-red-500/10">
            {status.detail}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      role="status"
      aria-live="polite"
      className={cn(
        "border border-green-200 bg-green-50 p-3 rounded-md dark:border-green-500/30 dark:bg-green-950",
        placementClass,
        className,
      )}
    >
      {header}
      <Paragraph tone="success" size="sm">
        {status.message}
      </Paragraph>
      {status.actions && status.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {status.actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={action.onSelect}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
