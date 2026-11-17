import { useEffect, useState } from "react";

export const useNow = (intervalMs: number, enabled = true): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(intervalId);
  }, [intervalMs, enabled]);

  return now;
};
