import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

interface AnimatedHeightProps {
  children: React.ReactNode;
  className?: string;
  /** Duration of the height transition in milliseconds */
  duration?: number;
  /** Easing function for the transition */
  easing?: string;
  /** Key that changes when content changes - triggers re-measurement */
  contentKey?: string | number;
}

/**
 * A component that smoothly animates its height based on content changes.
 * Uses ResizeObserver to detect content size changes and applies CSS transitions.
 * During shrink transitions, overflow is visible to prevent content clipping.
 */
export function AnimatedHeight({
  children,
  className,
  duration = 200,
  easing = "ease-out",
  contentKey,
}: AnimatedHeightProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [enableTransition, setEnableTransition] = useState(false);
  const [isShrinking, setIsShrinking] = useState(false);
  const prevHeightRef = useRef<number | null>(null);
  const shrinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMeasurementRef = useRef(true);
  const isTransitioningRef = useRef(false);

  const measureHeight = useCallback(
    (force = false) => {
      if (isTransitioningRef.current && !force) return;

      const contentEl = contentRef.current;
      if (!contentEl) return;

      const newHeight = contentEl.offsetHeight;
      const prevHeight = prevHeightRef.current;

      if (newHeight !== prevHeight && newHeight > 0) {
        const shrinking = prevHeight !== null && newHeight < prevHeight;

        if (shrinkTimeoutRef.current) {
          clearTimeout(shrinkTimeoutRef.current);
          shrinkTimeoutRef.current = null;
        }

        if (shrinking) {
          setIsShrinking(true);
          shrinkTimeoutRef.current = setTimeout(() => {
            setIsShrinking(false);
          }, duration);
        }

        prevHeightRef.current = newHeight;
        setHeight(newHeight);

        if (isFirstMeasurementRef.current) {
          isFirstMeasurementRef.current = false;
          requestAnimationFrame(() => {
            setEnableTransition(true);
          });
        }
      }
    },
    [duration],
  );

  // Handle contentKey changes synchronously before paint
  useLayoutEffect(() => {
    isTransitioningRef.current = true;

    // Measure synchronously - useLayoutEffect runs after DOM update but before paint
    measureHeight(true);

    isTransitioningRef.current = false;
  }, [contentKey, measureHeight]);

  // ResizeObserver for dynamic content changes (not during key transitions)
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!isTransitioningRef.current) {
        measureHeight();
      }
    });

    resizeObserver.observe(contentEl);

    return () => {
      resizeObserver.disconnect();
      if (shrinkTimeoutRef.current) {
        clearTimeout(shrinkTimeoutRef.current);
      }
    };
  }, [measureHeight]);

  return (
    <div
      className={cn(
        isShrinking ? "overflow-visible" : "overflow-hidden",
        className,
      )}
      style={{
        height: height !== null ? `${height}px` : "auto",
        transition: enableTransition
          ? `height ${duration}ms ${easing}`
          : undefined,
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
