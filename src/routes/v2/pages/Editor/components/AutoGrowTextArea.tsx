import {
  type ChangeEvent,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

import { MultilineTextInputDialog } from "@/components/shared/Dialogs/MultilineTextInputDialog";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function heightFormula(maxGrowHeight: string): string {
  return `min(var(--max-h, ${maxGrowHeight}), max(var(--content-h, 1lh), 1lh))`;
}

function measureContentHeight(el: HTMLTextAreaElement, formula: string): void {
  el.style.setProperty("height", "0px", "important");
  const scrollH = el.scrollHeight;
  el.style.setProperty("height", formula);
  el.style.setProperty("--content-h", `${scrollH}px`);
}

interface AutoGrowTextareaProps extends Omit<
  ComponentProps<typeof Textarea>,
  "onChange" | "value"
> {
  maxGrowHeight?: string;
  expandDialogTitle?: ReactNode;
  onChangeComplete?: (value: string) => void;
  highlightSyntax?: boolean;
}

export function AutoGrowTextarea({
  className,
  style,
  maxGrowHeight = "200px",
  defaultValue,
  onBlur,
  onFocus,
  onKeyDown,
  onPointerDown,
  onPointerUp,
  expandDialogTitle,
  onChangeComplete,
  highlightSyntax,
  ...props
}: AutoGrowTextareaProps) {
  const formula = heightFormula(maxGrowHeight);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelledRef = useRef(false);
  const expandingRef = useRef(false);
  const [localValue, setLocalValue] = useState(
    typeof defaultValue === "string" ? defaultValue : "",
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogInitialValue, setDialogInitialValue] = useState("");

  const setDefaultRef = (element: HTMLTextAreaElement) => {
    textareaRef.current = element;
    if (element) {
      measureContentHeight(element, formula);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    measureContentHeight(e.currentTarget, formula);
  };

  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    onFocus?.(e);
    measureContentHeight(e.currentTarget, formula);
  };

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    if (expandingRef.current) return;
    if (!cancelledRef.current) {
      onChangeComplete?.(localValue);
    }
    cancelledRef.current = false;
    onBlur?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
      return;
    }
    if (e.key === "Escape") {
      cancelledRef.current = true;
      const original = typeof defaultValue === "string" ? defaultValue : "";
      setLocalValue(original);
      if (textareaRef.current) {
        textareaRef.current.value = original;
        measureContentHeight(textareaRef.current, formula);
      }
      textareaRef.current?.blur();
      return;
    }
    onKeyDown?.(e);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    onPointerDown?.(e);
    e.currentTarget.dataset.h = String(e.currentTarget.offsetHeight);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    onPointerUp?.(e);
    const el = e.currentTarget;
    const before = Number(el.dataset.h);
    const after = el.offsetHeight;
    if (before !== after) {
      el.style.setProperty("--max-h", `${after}px`);
      el.style.setProperty("height", formula);
    }
  };

  const handleExpandClick = () => {
    expandingRef.current = true;
    setDialogInitialValue(localValue);
    setIsDialogOpen(true);
  };

  const handleDialogConfirm = (value: string) => {
    expandingRef.current = false;
    setIsDialogOpen(false);
    setLocalValue(value);
    if (textareaRef.current) {
      textareaRef.current.value = value;
      measureContentHeight(textareaRef.current, formula);
    }
    onChangeComplete?.(value);
  };

  const handleDialogCancel = () => {
    expandingRef.current = false;
    setIsDialogOpen(false);
  };

  const showExpandButton = expandDialogTitle && onChangeComplete;

  return (
    <>
      <div
        className={cn(showExpandButton && "group/expand relative", "w-full")}
      >
        <Textarea
          ref={setDefaultRef}
          className={cn(
            "field-sizing-fixed resize-y overflow-y-auto",
            className,
          )}
          style={{
            height: formula,
            ...style,
          }}
          defaultValue={defaultValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          {...props}
        />
        {showExpandButton && (
          <button
            type="button"
            className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/expand:opacity-100"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleExpandClick}
            tabIndex={-1}
          >
            <Icon name="Maximize2" size="xs" />
          </button>
        )}
      </div>
      {showExpandButton && (
        <MultilineTextInputDialog
          title={expandDialogTitle}
          initialValue={dialogInitialValue}
          open={isDialogOpen}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          highlightSyntax={highlightSyntax}
        />
      )}
    </>
  );
}
