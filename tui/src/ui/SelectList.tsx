import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";

interface SelectListProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  isActive?: boolean;
  emptyLabel?: string;
  /** Rows reserved for surrounding chrome when deriving the window from the terminal height. */
  reserveRows?: number;
  /** Caps the visible window explicitly, overriding the terminal-height estimate. */
  maxVisible?: number;
}

const DEFAULT_ROWS = 24;

export function SelectList<T>({
  items,
  getLabel,
  getKey,
  onSelect,
  isActive = true,
  emptyLabel = "Nothing to show.",
  reserveRows = 8,
  maxVisible,
}: SelectListProps<T>) {
  const { stdout } = useStdout();
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);

  const rows = stdout?.rows ?? DEFAULT_ROWS;
  const budget = Math.max(1, maxVisible ?? rows - reserveRows);
  const overflowing = items.length > budget;
  // Two rows go to the "more above/below" indicators when the list overflows.
  const windowSize = overflowing
    ? Math.max(1, budget - 2)
    : Math.max(1, items.length);

  useEffect(() => {
    if (index > items.length - 1) setIndex(Math.max(0, items.length - 1));
  }, [items.length, index]);

  useEffect(() => {
    setOffset((current) => {
      const maxOffset = Math.max(0, items.length - windowSize);
      let next = Math.min(current, maxOffset);
      if (index < next) next = index;
      else if (index >= next + windowSize) next = index - windowSize + 1;
      return Math.max(0, Math.min(next, maxOffset));
    });
  }, [index, windowSize, items.length]);

  useInput(
    (_input, key) => {
      if (items.length === 0) return;
      if (key.upArrow) setIndex((current) => Math.max(0, current - 1));
      else if (key.downArrow)
        setIndex((current) => Math.min(items.length - 1, current + 1));
      else if (key.return) {
        const selected = items[index];
        if (selected) onSelect(selected);
      }
    },
    { isActive },
  );

  if (items.length === 0) {
    return <Text dimColor>{emptyLabel}</Text>;
  }

  const visible = items.slice(offset, offset + windowSize);
  const hiddenAbove = offset;
  const hiddenBelow = Math.max(0, items.length - (offset + windowSize));

  return (
    <Box flexDirection="column">
      {overflowing ? (
        <Text dimColor>
          {hiddenAbove > 0 ? `  ↑ ${hiddenAbove} more` : " "}
        </Text>
      ) : null}
      {visible.map((item, visibleIndex) => {
        const itemIndex = offset + visibleIndex;
        const active = itemIndex === index;
        return (
          <Text key={getKey(item)} color={active ? "cyan" : undefined}>
            {active ? "› " : "  "}
            {getLabel(item)}
          </Text>
        );
      })}
      {overflowing ? (
        <Text dimColor>
          {hiddenBelow > 0 ? `  ↓ ${hiddenBelow} more` : " "}
        </Text>
      ) : null}
    </Box>
  );
}
