import { type ChangeEvent, type ComponentProps } from "react";

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

interface AutoGrowTextareaProps extends ComponentProps<typeof Textarea> {
  maxGrowHeight?: string;
}

export function AutoGrowTextarea({
  className,
  style,
  maxGrowHeight = "200px",
  defaultValue,
  onChange,
  onFocus,
  onPointerDown,
  onPointerUp,
  ...props
}: AutoGrowTextareaProps) {
  const formula = heightFormula(maxGrowHeight);

  const setDefaultRef = (element: HTMLTextAreaElement) => {
    if (element) {
      measureContentHeight(element, formula);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    measureContentHeight(e.currentTarget, formula);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onFocus?.(e);
    measureContentHeight(e.currentTarget, formula);
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

  return (
    <Textarea
      ref={setDefaultRef}
      className={cn("field-sizing-fixed resize-y overflow-y-auto", className)}
      style={{
        height: formula,
        ...style,
      }}
      onChange={handleChange}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      defaultValue={defaultValue}
      {...props}
    />
  );
}
