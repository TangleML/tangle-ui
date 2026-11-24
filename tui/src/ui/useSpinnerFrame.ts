import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 90;

/** A braille spinner frame that advances only while `active`, else sits still. */
export function useSpinnerFrame(active: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return FRAMES[active ? index : 0] ?? FRAMES[0];
}
