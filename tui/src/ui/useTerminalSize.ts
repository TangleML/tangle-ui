import { useStdout } from "ink";
import { useEffect, useState } from "react";

const DEFAULT_ROWS = 24;
const DEFAULT_COLUMNS = 80;

interface TerminalSize {
  rows: number;
  columns: number;
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => ({
    rows: stdout.rows ?? DEFAULT_ROWS,
    columns: stdout.columns ?? DEFAULT_COLUMNS,
  }));

  useEffect(() => {
    function onResize(): void {
      setSize({
        rows: stdout.rows ?? DEFAULT_ROWS,
        columns: stdout.columns ?? DEFAULT_COLUMNS,
      });
    }
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
