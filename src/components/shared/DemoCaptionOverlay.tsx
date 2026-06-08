import { useEffect, useState } from "react";

/**
 * Temporary demo-only component. Removed before any production deployment.
 *
 * Renders a Tangle-styled caption pill at the bottom-centre of the viewport.
 * Controlled by dispatching a CustomEvent on window:
 *
 *   window.dispatchEvent(new CustomEvent('__demo_caption__', {
 *     detail: { text: "Caption text here", durationMs: 4000 }
 *   }))
 *
 * Dispatching with text="" clears immediately.
 */

interface CaptionEvent {
  text: string;
  durationMs?: number;
}

export function DemoCaptionOverlay() {
  const [displayed, setDisplayed] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    let typeTimer: ReturnType<typeof setInterval> | null = null;

    const handler = (e: Event) => {
      const { text = "", durationMs = 4500 } = (e as CustomEvent<CaptionEvent>)
        .detail;

      // Cancel any pending timers from the previous caption.
      if (clearTimer) clearTimeout(clearTimer);
      if (typeTimer) clearInterval(typeTimer);

      if (!text) {
        setVisible(false);
        setDisplayed("");
        return;
      }

      setVisible(true);
      setDisplayed("");

      // Typewriter: reveal one character every 26 ms.
      let i = 0;
      typeTimer = setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (typeTimer) clearInterval(typeTimer);
          typeTimer = null;
          // Auto-clear after durationMs once fully typed.
          clearTimer = setTimeout(() => {
            setVisible(false);
            setDisplayed("");
          }, durationMs);
        }
      }, 26);
    };

    window.addEventListener("__demo_caption__", handler);
    return () => {
      window.removeEventListener("__demo_caption__", handler);
      if (clearTimer) clearTimeout(clearTimer);
      if (typeTimer) clearInterval(typeTimer);
    };
  }, []);

  if (!visible && !displayed) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2.5 shadow-lg">
        {/* Animated recording indicator dot */}
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" />
        <span className="max-w-xl text-sm font-medium text-foreground">
          {displayed}
          {/* Blinking cursor while typing */}
          {displayed.length > 0 && (
            <span className="ml-0.5 inline-block w-0.5 animate-[blink_0.8s_step-end_infinite] bg-foreground align-middle text-transparent">
              |
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
